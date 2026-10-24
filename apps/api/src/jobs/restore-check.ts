import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { type EncryptedField, EnvelopeEncryptor, type FieldEncryptor } from '@heach/crypto';
import { createLogger } from '@heach/logger';
import { NestFactory } from '@nestjs/core';
import pg from 'pg';
import { AppModule } from '../app.module.js';
import { AuditService } from '../audit/audit.service.js';
import { runWithContext } from '../common/request-context.js';
import { validateEnv } from '../config/env.validate.js';
import { createKeyProvider } from '../crypto/crypto.module.js';
import { PgDataKeyStore } from '../crypto/pg-data-key-store.js';
import { pgClientConfig } from '../db/connection.js';
import { loadSecrets } from '../secrets/load-secrets.js';

const MAX_ROWS = 1_000;
const THROWAWAY = /^heach_restorecheck_\d+$/;
const logger = createLogger({ name: 'jobs' });

type Pool = Pick<pg.Pool, 'query'>;

export interface RestoreCheckResult {
  outcome: 'pass' | 'fail';
  /** The last stage reached: where a failed run stopped. */
  stage: 'audit-chain' | 'decrypt';
  tables: Record<string, number>;
  decrypted: number;
  failed: number;
}

/** The live URL pointed at a throwaway database; refuses any other name (EN-10.9). */
export function restoreDatabaseUrl(databaseUrl: string, name: string): string {
  if (!THROWAWAY.test(name)) {
    throw new Error('RESTORE_DATABASE_NAME is not a restore-check database');
  }
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

const quoted = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

async function countTables(restored: Pool): Promise<Record<string, number>> {
  const { rows } = await restored.query<{ name: string }>(
    `SELECT table_schema || '.' || table_name AS name FROM information_schema.tables
      WHERE table_schema IN ('app', 'audit') AND table_type = 'BASE TABLE' ORDER BY 1`,
  );
  const tables: Record<string, number> = {};
  for (const { name } of rows) {
    const [schema = '', table = ''] = name.split('.');
    const count = await restored.query<{ n: string }>(
      `SELECT count(*) AS n FROM ${quoted(schema)}.${quoted(table)}`,
    );
    tables[name] = Number(count.rows[0]?.n);
  }
  return tables;
}

/** Decrypts up to 1,000 note bodies, newest first, keeping counts only (EN-10.7). */
async function decryptNotes(
  restored: Pool,
  encryptor: FieldEncryptor,
): Promise<{ decrypted: number; failed: number }> {
  const { rows } = await restored.query<{ body: EncryptedField }>(
    `SELECT body FROM app.patient_note ORDER BY created_at DESC LIMIT ${String(MAX_ROWS)}`,
  );
  const counts = { decrypted: 0, failed: 0 };
  for (const { body } of rows) {
    // The plaintext is discarded at once; only whether it authenticated is kept.
    const ok = await encryptor.decrypt(body).then(
      () => true,
      () => false,
    );
    counts[ok ? 'decrypted' : 'failed'] += 1;
  }
  return counts;
}

/**
 * Checks a database restored from a backup: counts every table, verifies the audit chain, then
 * decrypts Restricted values with the data keys stored in that same database (EN-10.5, EN-10.7).
 */
export async function checkRestoredDatabase(
  restored: Pool,
  encryptor: FieldEncryptor,
): Promise<RestoreCheckResult> {
  const tables = await countTables(restored);
  const { rows } = await restored.query<{ broken: string | null }>(
    'SELECT audit.verify_chain() AS broken',
  );
  if (rows[0]?.broken != null) {
    return { outcome: 'fail', stage: 'audit-chain', tables, decrypted: 0, failed: 0 };
  }
  const counts = await decryptNotes(restored, encryptor);
  const outcome = counts.failed === 0 ? 'pass' : 'fail';
  return { outcome, stage: 'decrypt', tables, ...counts };
}

/**
 * One summary entry in the live audit log (spec 006 D-3, EN-10.10): the dump name, no IDs or
 * values. A passing run must be audited; a failing one is recorded on a best-effort basis.
 */
export async function recordCheck(
  audit: AuditService,
  dumpName: string,
  result: RestoreCheckResult,
): Promise<void> {
  const action = result.outcome === 'pass' ? 'backup.restore_check' : 'backup.restore_check.failed';
  const written = audit.record({ action, entity: 'backup', entityId: dumpName });
  await (result.outcome === 'pass' ? written : written.catch(() => undefined));
}

/**
 * The job command (spec 006 plan, command contract): checks RESTORE_DATABASE_NAME, writes the
 * summary entry to the live database, logs one line of counts and returns the exit code.
 */
export async function main(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  await loadSecrets(env);
  const vars = validateEnv(env);
  const restored = new pg.Pool({
    ...pgClientConfig(
      restoreDatabaseUrl(vars.DATABASE_URL, env.RESTORE_DATABASE_NAME ?? ''),
      vars.DATABASE_PASSWORD,
      vars.DATA_TLS_CA_FILE,
    ),
    max: 2,
  });
  const app = await NestFactory.createApplicationContext(AppModule.forEnv(vars.APP_ENV), {
    logger: ['error'],
  });
  const runId = env.RESTORE_RUN_ID ?? `restorecheck-${randomUUID()}`;
  const dump = env.RESTORE_DUMP_NAME ?? 'unknown';
  try {
    return await runWithContext({ correlationId: runId, system: 'job:restore-check' }, async () => {
      // Data keys come from the restored copy: the check proves the dump itself decrypts.
      const encryptor = new EnvelopeEncryptor(
        createKeyProvider(vars),
        new PgDataKeyStore(restored),
      );
      const checked = await checkRestoredDatabase(restored, encryptor);
      // Reading Restricted values without an audit entry is a failed decrypt stage (SE-05).
      const audited = await recordCheck(app.get(AuditService), dump, checked).then(
        () => true,
        () => false,
      );
      const result: RestoreCheckResult = audited ? checked : { ...checked, outcome: 'fail' };
      logger.info({ runId, dump, ...result }, 'Restore check finished');
      return result.outcome === 'pass' ? 0 : 1;
    });
  } finally {
    await Promise.all([app.close(), restored.end()]);
  }
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  process.exitCode = await main().catch((error: unknown) => {
    logger.error(
      { error: error instanceof Error ? error.name : 'unknown' },
      'Restore check could not run',
    );
    return 1;
  });
}
