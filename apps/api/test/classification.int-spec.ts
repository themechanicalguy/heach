import type pg from 'pg';
import { checkClassification } from '../src/db/check-classification.js';
import { connectAs } from './db.js';

describe('Data classification check (DC-01)', () => {
  let admin: pg.Client;

  beforeAll(async () => {
    admin = await connectAs('admin');
    // Failing fixture: a throwaway schema with one column of each problem.
    await admin.query(`
      DROP SCHEMA IF EXISTS dc_fixture CASCADE;
      CREATE SCHEMA dc_fixture;
      CREATE TABLE dc_fixture.sample (untagged text, plain_restricted text, ok_restricted app.encrypted_field, ok_internal text);
      COMMENT ON COLUMN dc_fixture.sample.plain_restricted IS 'class=Restricted';
      COMMENT ON COLUMN dc_fixture.sample.ok_restricted IS 'class=Restricted';
      COMMENT ON COLUMN dc_fixture.sample.ok_internal IS 'class=Internal';
    `);
  });

  afterAll(async () => {
    await admin.query('DROP SCHEMA dc_fixture CASCADE');
    await admin.end();
  });

  it('DC-01.1 names a column without a class tag', async () => {
    const problems = await checkClassification(admin, ['dc_fixture']);
    expect(problems.map((p) => p.column)).toContain('dc_fixture.sample.untagged');
  });

  it('DC-01.2 names a Restricted column not stored through @heach/crypto', async () => {
    const problems = await checkClassification(admin, ['dc_fixture']);
    expect(problems.map((p) => p.column).sort((a, b) => a.localeCompare(b))).toEqual([
      'dc_fixture.sample.plain_restricted',
      'dc_fixture.sample.untagged',
    ]);
  });

  it('DC-01.1 passes for the real app and audit schemas', async () => {
    expect(await checkClassification(admin)).toEqual([]);
  });
});
