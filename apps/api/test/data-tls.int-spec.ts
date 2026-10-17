import { Redis } from 'ioredis';
import pg from 'pg';
import { pgClientConfig, withPassword } from '../src/db/connection.js';

const { DATABASE_URL = '', DATABASE_PASSWORD, REDIS_URL = '', DATA_TLS_CA_FILE = '' } = process.env;

describe('Data store TLS (EN-01.1)', () => {
  it('EN-01.1 PostgreSQL refuses a plaintext connection', async () => {
    const client = new pg.Client({
      connectionString: withPassword(DATABASE_URL, DATABASE_PASSWORD),
      ssl: false,
    });
    await expect(client.connect()).rejects.toThrow(/no encryption|pg_hba/);
  });

  it('EN-01.1 PostgreSQL accepts TLS 1.2 or higher verified against the data CA', async () => {
    const client = new pg.Client(pgClientConfig(DATABASE_URL, DATABASE_PASSWORD, DATA_TLS_CA_FILE));
    await client.connect();
    const { rows } = await client.query<{ ssl: boolean; version: string }>(
      'SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid()',
    );
    await client.end();
    expect(rows[0]?.ssl).toBe(true);
    expect(['TLSv1.2', 'TLSv1.3']).toContain(rows[0]?.version);
  });

  it('EN-01.1 Redis refuses a plaintext connection', async () => {
    const plain = new Redis(REDIS_URL.replace('rediss://', 'redis://'), {
      connectTimeout: 1_000,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
      lazyConnect: true,
    });
    plain.on('error', () => undefined);
    await expect(plain.connect().then(() => plain.ping())).rejects.toThrow();
    plain.disconnect();
  });
});
