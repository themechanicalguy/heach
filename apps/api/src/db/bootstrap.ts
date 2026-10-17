import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { createLogger } from '@heach/logger';
import pg from 'pg';
import { loadSecrets } from '../secrets/load-secrets.js';
import { pgClientConfig, requireEnv } from './connection.js';

const SQL = readFileSync(new URL('../../sql/bootstrap.sql', import.meta.url), 'utf8');

/** Creates roles, schemas and the audit log as the superuser, then sets the role passwords. */
export async function bootstrapDatabase(env: Record<string, string | undefined>): Promise<void> {
  const client = new pg.Client(
    pgClientConfig(
      requireEnv(env, 'DATABASE_ADMIN_URL'),
      env.DATABASE_ADMIN_PASSWORD,
      requireEnv(env, 'DATA_TLS_CA_FILE'),
    ),
  );
  await client.connect();
  try {
    await client.query(SQL);
    await setPassword(client, 'heach_migrator', requireEnv(env, 'DATABASE_MIGRATOR_PASSWORD'));
    await setPassword(client, 'heach_app', requireEnv(env, 'DATABASE_PASSWORD'));
    const { rows } = await client.query<{ db: string }>('SELECT current_database() AS db');
    const db = client.escapeIdentifier(rows[0]?.db ?? '');
    await client.query(`REVOKE ALL ON DATABASE ${db} FROM PUBLIC`);
    await client.query(`GRANT CONNECT ON DATABASE ${db} TO heach_migrator, heach_app`);
  } finally {
    await client.end();
  }
}

async function setPassword(client: pg.Client, role: string, password: string): Promise<void> {
  await client.query(
    `ALTER ROLE ${client.escapeIdentifier(role)} PASSWORD ${client.escapeLiteral(password)}`,
  );
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  await loadSecrets(process.env, ['POSTGRES_PASSWORD', 'DB_MIGRATOR_PASSWORD', 'DB_APP_PASSWORD']);
  await bootstrapDatabase(process.env);
  createLogger({ name: 'db' }).info('Database roles and audit schema are in place');
}
