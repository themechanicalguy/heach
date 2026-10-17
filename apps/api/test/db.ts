import pg from 'pg';
import { pgClientConfig } from '../src/db/connection.js';

type Role = 'admin' | 'migrator' | 'app';

const URLS: Record<Role, [string, string]> = {
  admin: ['DATABASE_ADMIN_URL', 'DATABASE_ADMIN_PASSWORD'],
  migrator: ['DATABASE_MIGRATOR_URL', 'DATABASE_MIGRATOR_PASSWORD'],
  app: ['DATABASE_URL', 'DATABASE_PASSWORD'],
};

/** A connected client for one database role, over TLS. Caller ends it. */
export async function connectAs(role: Role): Promise<pg.Client> {
  const [url, password] = URLS[role];
  const client = new pg.Client(
    pgClientConfig(
      process.env[url] ?? '',
      process.env[password],
      process.env.DATA_TLS_CA_FILE ?? '',
    ),
  );
  await client.connect();
  return client;
}
