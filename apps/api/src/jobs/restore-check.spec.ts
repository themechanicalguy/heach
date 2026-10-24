import type { EncryptedField, FieldEncryptor } from '@heach/crypto';
import type pg from 'pg';
import type { AuditEvent, AuditService } from '../audit/audit.service.js';
import {
  checkRestoredDatabase,
  recordCheck,
  type RestoreCheckResult,
  restoreDatabaseUrl,
} from './restore-check.js';

const SYNTHETIC_BODY = 'synthetic restore-check body';

function field(n: number): EncryptedField {
  return {
    domain: 'health',
    keyVersion: '1',
    algorithm: 'AES-256-GCM',
    ciphertext: `c${String(n)}`,
  };
}

/** A restored database with the given broken audit link and note bodies. */
function fakeRestored(broken: string | null, bodies: EncryptedField[]) {
  const queries: string[] = [];
  const query = vi.fn((sql: string) => {
    queries.push(sql);
    if (sql.includes('verify_chain')) return Promise.resolve({ rows: [{ broken }] });
    if (sql.includes('information_schema.tables')) {
      return Promise.resolve({ rows: [{ name: 'app.patient_note' }, { name: 'audit.entry' }] });
    }
    if (sql.startsWith('SELECT count(*)')) return Promise.resolve({ rows: [{ n: '3' }] });
    if (sql.includes('FROM app.patient_note')) {
      return Promise.resolve({ rows: bodies.map((body) => ({ body })) });
    }
    return Promise.reject(new Error(`unexpected query ${sql}`));
  });
  return { pool: { query } as unknown as Pick<pg.Pool, 'query'>, queries };
}

function fakeEncryptor(failOn: EncryptedField[] = []) {
  const decrypt = vi.fn((value: EncryptedField) =>
    failOn.includes(value)
      ? Promise.reject(new Error('Unsupported state or unable to authenticate data'))
      : Promise.resolve(SYNTHETIC_BODY),
  );
  return { encryptor: { decrypt } as unknown as FieldEncryptor, decrypt };
}

describe('restore check job (spec 006)', () => {
  it('EN-10.5 passes with the row count of each table and the decrypted count', async () => {
    const { pool } = fakeRestored(null, [field(1), field(2)]);
    const { encryptor } = fakeEncryptor();
    const result = await checkRestoredDatabase(pool, encryptor);
    expect(result).toEqual({
      outcome: 'pass',
      stage: 'decrypt',
      tables: { 'app.patient_note': 3, 'audit.entry': 3 },
      decrypted: 2,
      failed: 0,
    });
  });

  it('EN-10.7 stops at audit-chain on a broken link and decrypts nothing', async () => {
    const { pool } = fakeRestored('7', [field(1)]);
    const { encryptor, decrypt } = fakeEncryptor();
    const result = await checkRestoredDatabase(pool, encryptor);
    expect(result.outcome).toBe('fail');
    expect(result.stage).toBe('audit-chain');
    expect(decrypt).not.toHaveBeenCalled();
  });

  it('EN-10.7 fails at decrypt when one value does not authenticate; reads 1,000 newest at most', async () => {
    const bad = field(2);
    const { pool, queries } = fakeRestored(null, [field(1), bad, field(3)]);
    const { encryptor } = fakeEncryptor([bad]);
    const result = await checkRestoredDatabase(pool, encryptor);
    expect(result).toMatchObject({ outcome: 'fail', stage: 'decrypt', decrypted: 2, failed: 1 });
    expect(queries.find((sql) => sql.includes('FROM app.patient_note'))).toMatch(
      /ORDER BY created_at DESC LIMIT 1000/,
    );
  });

  it('EN-10.7 quotes table names it reads from the catalogue', async () => {
    const { pool, queries } = fakeRestored(null, []);
    await checkRestoredDatabase(pool, fakeEncryptor().encryptor);
    expect(queries).toContain('SELECT count(*) AS n FROM "app"."patient_note"');
  });

  it('EN-10.9 connects only to a throwaway database name', () => {
    const live = 'postgresql://heach_app@postgres:5432/heach';
    expect(restoreDatabaseUrl(live, 'heach_restorecheck_1792900000')).toBe(
      'postgresql://heach_app@postgres:5432/heach_restorecheck_1792900000',
    );
    for (const name of [
      'heach',
      'heach_local',
      'heach_restorecheck_',
      'heach_restorecheck_1;x',
      '',
    ]) {
      expect(() => restoreDatabaseUrl(live, name)).toThrow(/not a restore-check database/);
    }
  });
});

describe('restore check summary audit entry (spec 006)', () => {
  it.each([
    ['pass', 'backup.restore_check'],
    ['fail', 'backup.restore_check.failed'],
  ] as const)(
    'EN-10.10 a %s run writes one entry with the dump name only',
    async (outcome, action) => {
      const record = vi.fn<(event: AuditEvent) => Promise<void>>(() => Promise.resolve());
      const result: RestoreCheckResult = {
        outcome,
        stage: 'decrypt',
        tables: {},
        decrypted: 1,
        failed: 0,
      };
      await recordCheck({ record } as unknown as AuditService, 'pg/2026-10-25T2100Z.dump', result);
      expect(record).toHaveBeenCalledTimes(1);
      expect(record).toHaveBeenCalledWith({
        action,
        entity: 'backup',
        entityId: 'pg/2026-10-25T2100Z.dump',
      });
    },
  );

  it('EN-10.10 a failed run still ends when its audit entry cannot be written', async () => {
    const record = vi.fn(() => Promise.reject(new Error('audit down')));
    const result: RestoreCheckResult = {
      outcome: 'fail',
      stage: 'audit-chain',
      tables: {},
      decrypted: 0,
      failed: 0,
    };
    await expect(
      recordCheck({ record } as unknown as AuditService, 'pg/x.dump', result),
    ).resolves.toBeUndefined();
  });

  it('EN-10.10 a passing run fails at decrypt when its audit entry cannot be written', async () => {
    const record = vi.fn(() => Promise.reject(new Error('audit down')));
    const result: RestoreCheckResult = {
      outcome: 'pass',
      stage: 'decrypt',
      tables: {},
      decrypted: 1,
      failed: 0,
    };
    await expect(
      recordCheck({ record } as unknown as AuditService, 'pg/x.dump', result),
    ).rejects.toThrow('audit down');
  });
});
