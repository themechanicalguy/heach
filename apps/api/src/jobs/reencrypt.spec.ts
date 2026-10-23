import type { EncryptedField } from '@heach/crypto';
import type pg from 'pg';
import type { AuditService } from '../audit/audit.service.js';
import { reencryptHealth } from './reencrypt.js';

const TARGET = 2;
const MAX_SELECTS = 20; // a loop that keeps selecting fails here instead of hanging the test

interface FakeRow {
  id: string;
  version: number;
  outcome: 'update' | 'unchanged' | 'undecryptable';
}

const field = (row: FakeRow): EncryptedField => ({
  ciphertext: row.id,
  keyVersion: String(row.version),
  algorithm: 'AES-256-GCM',
  domain: 'health',
});

function rowsOf(count: number, version: number, outcome: FakeRow['outcome'], from = 0): FakeRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(from + i).padStart(12, '0')}`,
    version,
    outcome,
  }));
}

/** A fake table: SELECT honours the cursor, version and LIMIT; UPDATE matches per row outcome. */
function setup(table: FakeRow[]) {
  let selects = 0;
  const select = (params: unknown[]) => {
    selects += 1;
    if (selects > MAX_SELECTS) throw new Error('loop bound reached');
    const [cursor, target] = params as [string | null, number | string];
    const rows = table
      .filter((r) => (cursor === null || r.id > cursor) && r.version < Number(target))
      .toSorted((a, b) => a.id.localeCompare(b.id))
      .slice(0, 100);
    return { rows: rows.map((r) => ({ id: r.id, body: field(r) })) };
  };
  const update = (params: unknown[]) => {
    const row = table.find((r) => r.id === params[0]);
    return { rows: [], rowCount: row?.outcome === 'update' ? 1 : 0 };
  };
  const query = vi.fn((sql: string, params: unknown[] = []) => {
    if (sql.trimStart().startsWith('SELECT id')) return Promise.resolve(select(params));
    if (sql.startsWith('UPDATE')) return Promise.resolve(update(params));
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
  const pool = {
    query,
    connect: vi.fn().mockResolvedValue({ query, release: vi.fn() }),
  } as unknown as Pick<pg.Pool, 'query' | 'connect'>;
  const encryptor = {
    currentKeyVersion: vi.fn().mockResolvedValue(String(TARGET)),
    decrypt: vi.fn((value: EncryptedField) => {
      const row = table.find((r) => r.id === value.ciphertext);
      return row?.outcome === 'undecryptable'
        ? Promise.reject(new Error('bad tag'))
        : Promise.resolve('synthetic');
    }),
    encrypt: vi.fn().mockResolvedValue(field({ id: 'fresh', version: TARGET, outcome: 'update' })),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const run = () => reencryptHealth(pool, encryptor, audit as unknown as AuditService);
  return { run, encryptor, selects: () => selects };
}

describe('reencryptHealth', () => {
  it('EN-05.4 one pass even when rows cannot be updated or decrypted', async () => {
    const table = [...rowsOf(240, 1, 'unchanged'), ...rowsOf(10, 1, 'undecryptable', 240)];
    const { run, encryptor, selects } = setup(table);
    await run();
    expect(encryptor.decrypt).toHaveBeenCalledTimes(250);
    expect(selects()).toBeLessThanOrEqual(Math.ceil(250 / 100) + 1);
  });

  it('EN-05.5 only rows below the target version are re-encrypted', async () => {
    const table = [
      ...rowsOf(3, 1, 'update'),
      ...rowsOf(3, TARGET, 'update', 3),
      ...rowsOf(3, TARGET + 1, 'update', 6),
    ];
    const { run, encryptor } = setup(table);
    await run();
    const decrypted = encryptor.decrypt.mock.calls.map(([value]) => value.keyVersion);
    expect(decrypted).toEqual(['1', '1', '1']);
  });

  it('EN-05.6 counts are what actually happened', async () => {
    const table = [
      ...rowsOf(5, 1, 'update'),
      ...rowsOf(3, 1, 'unchanged', 5),
      ...rowsOf(2, 1, 'undecryptable', 8),
    ];
    const { run } = setup(table);
    await expect(run()).resolves.toEqual({ reencrypted: 5, skipped: 3, failed: 2 });
  });
});
