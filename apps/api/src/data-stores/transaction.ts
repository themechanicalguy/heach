import { Logger } from '@nestjs/common';
import type pg from 'pg';

export type TransactionClient = Pick<pg.PoolClient, 'query'>;

/**
 * Runs `work` on one connection inside BEGIN and COMMIT: all its statements commit or none do
 * (SE-05.9). Callers run every statement of the unit on the client they are given and make no
 * network calls (KMS, SMS) inside it. The connection is released exactly once; when ROLLBACK
 * itself fails it is destroyed, so no borrower inherits a broken transaction.
 */
export async function withTransaction<T>(
  pool: Pick<pg.Pool, 'connect'>,
  work: (client: TransactionClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let broken: Error | undefined;
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    broken = await rollback(client);
    throw error;
  } finally {
    if (broken) client.release(broken);
    else client.release();
  }
}

/** Rolls back; returns the rollback error, if any, so the connection is destroyed. */
async function rollback(client: TransactionClient): Promise<Error | undefined> {
  try {
    await client.query('ROLLBACK');
    return undefined;
  } catch (error) {
    const failure = error instanceof Error ? error : new Error('Rollback failed');
    new Logger('Transaction').warn(`Rollback failed: ${failure.name}`);
    return failure;
  }
}
