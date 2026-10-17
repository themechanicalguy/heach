import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import { createLogger } from '@heach/logger';
import { runner } from 'node-pg-migrate';
import { loadSecrets } from '../secrets/load-secrets.js';
import { pgClientConfig, requireEnv } from './connection.js';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url));

/** Applies every pending migration as heach_migrator (EN-10.1). Forward only. */
export async function migrate(env: Record<string, string | undefined>): Promise<string[]> {
  const applied = await runner({
    databaseUrl: pgClientConfig(
      requireEnv(env, 'DATABASE_MIGRATOR_URL'),
      env.DATABASE_MIGRATOR_PASSWORD,
      requireEnv(env, 'DATA_TLS_CA_FILE'),
    ),
    dir: MIGRATIONS_DIR,
    direction: 'up',
    migrationsTable: 'pgmigrations',
    migrationsSchema: 'migrations',
    schema: 'app',
    checkOrder: true,
    singleTransaction: true,
    log: () => undefined,
  });
  return applied.map((migration) => migration.name);
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  await loadSecrets(process.env, ['DB_MIGRATOR_PASSWORD']);
  const applied = await migrate(process.env);
  createLogger({ name: 'db' }).info({ applied }, 'Migrations applied');
}
