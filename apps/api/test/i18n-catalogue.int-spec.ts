import { readFile } from 'node:fs/promises';
import type pg from 'pg';
import { connectAs } from './db.js';

const NAMES = [
  ['nursing_vitals_check', 'ଜୀବନ ଚିହ୍ନ ଯାଞ୍ଚ', 'ରକ୍ତଚାପ ଓ ନାଡ଼ି ଯାଞ୍ଚ'],
  ['nursing_iv_fluids', 'IV ତରଳ', 'IV ସାଲାଇନ୍'],
  ['attendant_day_12h', 'ସେବକ, ୧୨ ଘଣ୍ଟା ଦିନ ପାଳି', 'ରୋଗୀ ସହାୟକ, ୧୨ ଘଣ୍ଟା ଦିନ ପାଳି'],
  ['attendant_night_12h', 'ସେବକ, ୧୨ ଘଣ୍ଟା ରାତି ପାଳି', 'ରୋଗୀ ସହାୟକ, ୧୨ ଘଣ୍ଟା ରାତି ପାଳି'],
  ['attendant_24h', 'ସେବକ, ୨୪ ଘଣ୍ଟା ଯତ୍ନ', 'ରୋଗୀ ସହାୟକ, ୨୪ ଘଣ୍ଟା ଯତ୍ନ'],
];

describe('Odia clinical catalogue corrections (I18N-05)', () => {
  let client: pg.Client;
  beforeAll(async () => {
    client = await connectAs('migrator');
  });
  afterAll(async () => {
    await client.end();
  });

  it('applies the corrected names through the deployed migration chain', async () => {
    const result = await client.query<{ code: string; name: string }>(
      `
      SELECT item.code, text.name FROM app.catalogue_item AS item
      JOIN app.catalogue_item_text AS text ON text.item_id = item.id
      WHERE text.locale = 'or' AND item.code = ANY($1::text[])
    `,
      [NAMES.map(([code]) => code)],
    );
    expect(result.rows).toHaveLength(NAMES.length);
    for (const [code, , name] of NAMES) expect(result.rows).toContainEqual({ code, name });
  });

  it('upgrades old seeds idempotently while preserving operations edits and other locales', async () => {
    await client.query('BEGIN');
    try {
      const before = await client.query(
        'SELECT * FROM app.catalogue_item_text WHERE locale <> $1 ORDER BY item_id, locale',
        ['or'],
      );
      for (const [code, old] of NAMES) {
        await client.query(
          `UPDATE app.catalogue_item_text SET name = $1
          WHERE locale = 'or' AND item_id = (SELECT id FROM app.catalogue_item WHERE code = $2)`,
          [old, code],
        );
      }
      await client.query(`UPDATE app.catalogue_item_text SET name = 'Synthetic edited name'
        WHERE locale = 'or' AND item_id = (SELECT id FROM app.catalogue_item WHERE code = 'attendant_24h')`);
      const migration = await readFile(
        new URL('../migrations/0019_odia_catalogue_terminology.sql', import.meta.url),
        'utf8',
      );
      await client.query(migration);
      await client.query(migration);
      for (const [code, , expected] of NAMES) {
        const result = await client.query<{ name: string }>(
          `SELECT name FROM app.catalogue_item_text
          WHERE locale = 'or' AND item_id = (SELECT id FROM app.catalogue_item WHERE code = $1)`,
          [code],
        );
        expect(result.rows[0]?.name).toBe(
          code === 'attendant_24h' ? 'Synthetic edited name' : expected,
        );
      }
      const after = await client.query(
        'SELECT * FROM app.catalogue_item_text WHERE locale <> $1 ORDER BY item_id, locale',
        ['or'],
      );
      expect(after.rows).toEqual(before.rows);
    } finally {
      await client.query('ROLLBACK');
    }
  });
});
