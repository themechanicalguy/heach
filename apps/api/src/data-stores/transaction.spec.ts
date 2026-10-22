import type pg from 'pg';
import { withTransaction } from './transaction.js';

type Step = 'BEGIN' | 'COMMIT' | 'ROLLBACK' | 'work';

/** A fake pool whose one client records statements and can be told to fail at a step. */
function fakePool(failAt: Step[] = []) {
  const statements: string[] = [];
  const release = vi.fn();
  const query = vi.fn((sql: string) => {
    statements.push(sql);
    const step: Step = sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK' ? sql : 'work';
    return failAt.includes(step)
      ? Promise.reject(new Error(`${step} failed`))
      : Promise.resolve({ rows: [] });
  });
  const pool = { connect: vi.fn().mockResolvedValue({ query, release }) };
  return { pool: pool as unknown as Pick<pg.Pool, 'connect'>, statements, release };
}

const work = (client: { query: (sql: string) => Promise<unknown> }) =>
  client.query('INSERT').then(() => 'done');

describe('withTransaction', () => {
  it('SE-05.9 commits a unit that succeeds and releases the connection once', async () => {
    const { pool, statements, release } = fakePool();
    await expect(withTransaction(pool, work)).resolves.toBe('done');
    expect(statements).toEqual(['BEGIN', 'INSERT', 'COMMIT']);
    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith();
  });

  it('SE-05.9 rolls back a unit that throws and rethrows the original error', async () => {
    const { pool, statements, release } = fakePool(['work']);
    await expect(withTransaction(pool, work)).rejects.toThrow('work failed');
    expect(statements).toEqual(['BEGIN', 'INSERT', 'ROLLBACK']);
    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith();
  });

  it('SE-05.9 rolls back when COMMIT fails', async () => {
    const { pool, statements, release } = fakePool(['COMMIT']);
    await expect(withTransaction(pool, work)).rejects.toThrow('COMMIT failed');
    expect(statements).toEqual(['BEGIN', 'INSERT', 'COMMIT', 'ROLLBACK']);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('SE-05.9 destroys the connection when ROLLBACK fails, keeping the original error', async () => {
    const { pool, release } = fakePool(['work', 'ROLLBACK']);
    await expect(withTransaction(pool, work)).rejects.toThrow('work failed');
    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith(expect.objectContaining({ message: 'ROLLBACK failed' }));
  });

  it('SE-05.9 runs nothing when no connection can be borrowed', async () => {
    const pool = { connect: vi.fn().mockRejectedValue(new Error('timeout')) };
    const unit = vi.fn();
    await expect(
      withTransaction(pool as unknown as Pick<pg.Pool, 'connect'>, unit),
    ).rejects.toThrow('timeout');
    expect(unit).not.toHaveBeenCalled();
  });
});
