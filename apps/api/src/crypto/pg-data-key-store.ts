import type { DataDomain, DataKeyRecord, DataKeyStore } from '@heach/crypto';
import type pg from 'pg';
import { withTransaction } from '../data-stores/transaction.js';

interface DataKeyRow {
  domain: DataDomain;
  version: number;
  wrapped_key: Buffer;
  created_at: Date;
  retired_at: Date | null;
}

const COLUMNS = 'domain, version, wrapped_key, created_at, retired_at';

/** Wrapped data keys in `app.data_key` (Confidential); plaintext keys never reach the database. */
export class PgDataKeyStore implements DataKeyStore {
  constructor(private readonly pool: Pick<pg.Pool, 'query' | 'connect'>) {}

  async current(domain: DataDomain): Promise<DataKeyRecord | undefined> {
    const { rows } = await this.pool.query<DataKeyRow>(
      `SELECT ${COLUMNS} FROM app.data_key WHERE domain = $1 AND retired_at IS NULL`,
      [domain],
    );
    return rows[0] && toRecord(rows[0]);
  }

  async get(domain: DataDomain, version: number): Promise<DataKeyRecord | undefined> {
    const { rows } = await this.pool.query<DataKeyRow>(
      `SELECT ${COLUMNS} FROM app.data_key WHERE domain = $1 AND version = $2`,
      [domain, version],
    );
    return rows[0] && toRecord(rows[0]);
  }

  /** Retires the current version and inserts the new one in one transaction. */
  async add(record: DataKeyRecord): Promise<void> {
    await withTransaction(this.pool, async (client) => {
      await client.query(
        'UPDATE app.data_key SET retired_at = $2 WHERE domain = $1 AND retired_at IS NULL',
        [record.domain, record.createdAt],
      );
      await client.query(
        'INSERT INTO app.data_key (domain, version, wrapped_key, created_at) VALUES ($1, $2, $3, $4)',
        [record.domain, record.version, record.wrappedKey, record.createdAt],
      );
    });
  }
}

function toRecord(row: DataKeyRow): DataKeyRecord {
  return {
    domain: row.domain,
    version: row.version,
    wrappedKey: row.wrapped_key,
    createdAt: row.created_at,
    retiredAt: row.retired_at,
  };
}
