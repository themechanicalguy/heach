import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { connectAs } from './db.js';

async function append(client: pg.Client, action: string): Promise<void> {
  await client.query("SELECT audit.append($1, 'patient', $2, 'test', $3, $4)", [
    randomUUID(),
    action,
    randomUUID(),
    randomUUID(),
  ]);
}

async function verify(client: pg.Client): Promise<string | null> {
  const { rows } = await client.query<{ broken: string | null }>(
    'SELECT audit.verify_chain() AS broken',
  );
  return rows[0]?.broken ?? null;
}

describe('Audit hash chain (SE-05.2, SE-05.3)', () => {
  let admin: pg.Client;
  let app: pg.Client;
  let migrator: pg.Client;

  beforeAll(async () => {
    [admin, app, migrator] = await Promise.all([
      connectAs('admin'),
      connectAs('app'),
      connectAs('migrator'),
    ]);
  });

  afterAll(async () => {
    await Promise.all([admin.end(), app.end(), migrator.end()]);
  });

  // Tampering needs the superuser; each test leaves the chain repaired by truncating it.
  afterEach(async () => {
    await admin.query('TRUNCATE audit.entry');
  });

  it('SE-05.2 links each entry to the hash of the previous one', async () => {
    await append(app, 'a');
    await append(app, 'b');
    const { rows } = await admin.query<{ prev_hash: string; hash: string }>(
      'SELECT prev_hash, hash FROM audit.entry ORDER BY seq',
    );
    expect(rows[0]?.prev_hash).toBe('0'.repeat(64));
    expect(rows[1]?.prev_hash).toBe(rows[0]?.hash);
    expect(await verify(migrator)).toBeNull();
  });

  it('SE-05.3 reports the first altered entry', async () => {
    await append(app, 'a');
    await append(app, 'b');
    await append(app, 'c');
    const { rows } = await admin.query<{ seq: string }>('SELECT seq FROM audit.entry ORDER BY seq');
    await admin.query("UPDATE audit.entry SET action = 'forged' WHERE seq = $1", [rows[1]?.seq]);
    expect(await verify(migrator)).toBe(rows[1]?.seq);
  });

  it('SE-05.3 reports the entry after a deleted one', async () => {
    await append(app, 'a');
    await append(app, 'b');
    await append(app, 'c');
    const { rows } = await admin.query<{ seq: string }>('SELECT seq FROM audit.entry ORDER BY seq');
    await admin.query('DELETE FROM audit.entry WHERE seq = $1', [rows[1]?.seq]);
    expect(await verify(migrator)).toBe(rows[2]?.seq);
  });
});
