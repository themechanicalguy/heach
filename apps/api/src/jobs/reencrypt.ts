import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { EncryptedField, EnvelopeEncryptor, FieldEncryptor } from '@heach/crypto';
import { createLogger } from '@heach/logger';
import { NestFactory } from '@nestjs/core';
import type pg from 'pg';
import { AppModule } from '../app.module.js';
import { AuditService } from '../audit/audit.service.js';
import { runWithContext } from '../common/request-context.js';
import { validateEnv } from '../config/env.validate.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { withTransaction } from '../data-stores/transaction.js';
import { loadSecrets } from '../secrets/load-secrets.js';

const BATCH = 100;
const ENTITY = 'sample_note';
const logger = createLogger({ name: 'jobs' });

export interface ReencryptResult {
  reencrypted: number;
  skipped: number;
  failed: number;
}

interface NoteRow {
  id: string;
  body: EncryptedField;
}

type Pool = Pick<pg.Pool, 'query' | 'connect'>;

/**
 * Re-encrypts `health` values below the key version current at the start (EN-05.3). Walks the
 * table once by ID, so every run ends (EN-05.4); never touches rows on that version or newer
 * (EN-05.5); counts what actually happened (EN-05.6). Each changed row commits with its audit
 * entry (EN-05.7). Today the only such column is app.patient_note.body.
 * Runbook: docs/runbooks/key-rotation.md.
 */
export async function reencryptHealth(
  pool: Pool,
  encryptor: FieldEncryptor,
  audit: AuditService,
): Promise<ReencryptResult> {
  const target = Number(await encryptor.currentKeyVersion('health'));
  const result: ReencryptResult = { reencrypted: 0, skipped: 0, failed: 0 };
  let cursor: string | null = null;
  for (;;) {
    const { rows }: { rows: NoteRow[] } = await pool.query<NoteRow>(
      `SELECT id, body FROM app.patient_note
        WHERE ($1::uuid IS NULL OR id > $1) AND (body ->> 'keyVersion')::int < $2
        ORDER BY id LIMIT ${String(BATCH)}`,
      [cursor, target],
    );
    if (rows.length === 0) {
      return result;
    }
    for (const row of rows) {
      result[await reencryptRow(pool, encryptor, audit, row)] += 1;
    }
    cursor = rows[rows.length - 1]?.id ?? null;
  }
}

/** KMS work first; then the conditional update and its audit entry in one transaction. */
async function reencryptRow(
  pool: Pool,
  encryptor: FieldEncryptor,
  audit: AuditService,
  row: NoteRow,
): Promise<keyof ReencryptResult> {
  try {
    const fresh = await encryptor.encrypt(await encryptor.decrypt(row.body), 'health');
    const changed = await withTransaction(pool, async (client) => {
      const { rowCount } = await client.query(
        'UPDATE app.patient_note SET body = $2 WHERE id = $1 AND body = $3',
        [row.id, fresh, row.body],
      );
      if (rowCount !== 1) return false;
      await audit.record(
        { action: `${ENTITY}.reencrypt`, entity: ENTITY, entityId: row.id },
        client,
      );
      return true;
    });
    return changed ? 'reencrypted' : 'skipped';
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.name : 'unknown' }, 'Row not re-encrypted');
    await audit
      .record({ action: `${ENTITY}.reencrypt.failed`, entity: ENTITY, entityId: row.id })
      .catch(() => undefined);
    return 'failed';
  }
}

/**
 * The job command (specs/005-bounded-reencryption/contracts/reencrypt-job.md): rotates first with
 * `--rotate`, logs counts only, and returns the exit code, 1 when any row failed (EN-05.6).
 */
export async function main(argv: readonly string[] = process.argv): Promise<number> {
  await loadSecrets(process.env);
  const app = await NestFactory.createApplicationContext(
    AppModule.forEnv(validateEnv(process.env).APP_ENV),
    { logger: ['error'] },
  );
  const encryptor = app.get<EnvelopeEncryptor>(FIELD_ENCRYPTOR);
  const runId = `reencrypt-${randomUUID()}`;
  try {
    return await runWithContext({ correlationId: runId, system: 'job:reencrypt' }, async () => {
      if (argv.includes('--rotate')) {
        await encryptor.rotate('health');
      }
      const targetVersion = await encryptor.currentKeyVersion('health');
      logger.info({ runId, domain: 'health', targetVersion }, 'Re-encryption started');
      const counts = await reencryptHealth(app.get(PG_POOL), encryptor, app.get(AuditService));
      logger.info({ runId, domain: 'health', targetVersion, ...counts }, 'Re-encryption finished');
      return counts.failed > 0 ? 1 : 0;
    });
  } finally {
    await app.close();
  }
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  process.exitCode = await main().catch((error: unknown) => {
    logger.error(
      { error: error instanceof Error ? error.name : 'unknown' },
      'Re-encryption failed',
    );
    return 1;
  });
}
