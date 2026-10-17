import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { migrate } from '../src/db/migrate.js';
import { connectAs } from './db.js';

const DENIED = /permission denied|must be owner/;

describe('Database roles (EN-10.1, EN-10.2, SE-05.4)', () => {
  let app: pg.Client;
  let migrator: pg.Client;

  beforeAll(async () => {
    [app, migrator] = await Promise.all([connectAs('app'), connectAs('migrator')]);
  });

  afterAll(async () => {
    await Promise.all([app.end(), migrator.end()]);
  });

  it('EN-10.1 migrations ran forward from empty and a second run applies nothing', async () => {
    const { rows } = await migrator.query<{ name: string }>(
      'SELECT name FROM migrations.pgmigrations ORDER BY id',
    );
    expect(rows.map((r) => r.name)).toContain('0001_data_keys');
    expect(await migrate(process.env)).toEqual([]);
  });

  it('EN-10.2 the API role reads and writes application tables', async () => {
    await expect(app.query('SELECT count(*) FROM app.data_key')).resolves.toBeDefined();
  });

  it('EN-10.2 the API role cannot change the schema or read migrations', async () => {
    await expect(app.query('CREATE TABLE app.sneaky (id int)')).rejects.toThrow(DENIED);
    await expect(app.query('ALTER TABLE app.data_key ADD COLUMN x int')).rejects.toThrow(DENIED);
    await expect(app.query('SELECT * FROM migrations.pgmigrations')).rejects.toThrow(DENIED);
  });

  it('EN-10.2 neither role can change the audit schema', async () => {
    for (const client of [app, migrator]) {
      await expect(client.query('ALTER TABLE audit.entry ADD COLUMN x int')).rejects.toThrow(
        DENIED,
      );
      await expect(client.query('CREATE TABLE audit.sneaky (id int)')).rejects.toThrow(DENIED);
      await expect(client.query('DROP FUNCTION audit.verify_chain()')).rejects.toThrow(DENIED);
    }
  });

  it('SE-05.4 the API role can only append to the audit log', async () => {
    const id = randomUUID();
    await app.query("SELECT audit.append(NULL, 'anonymous', 'test.append', 'test', $1, $2)", [
      id,
      randomUUID(),
    ]);
    await expect(app.query('SELECT * FROM audit.entry')).rejects.toThrow(DENIED);
    await expect(app.query("UPDATE audit.entry SET action = 'x'")).rejects.toThrow(DENIED);
    await expect(app.query('DELETE FROM audit.entry')).rejects.toThrow(DENIED);
    await expect(
      app.query(
        "INSERT INTO audit.entry (id, at, actor_role, action, entity, correlation_id, prev_hash, hash) VALUES (gen_random_uuid(), now(), 'x', 'x', 'x', 'x', 'x', 'x')",
      ),
    ).rejects.toThrow(DENIED);
  });
});
