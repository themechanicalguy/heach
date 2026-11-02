import type pg from 'pg';

/** Snapshot only the Public content keys a suite mutates; restore even after a failed assertion. */
function restoreContentRows(
  db: () => pg.Client,
  table: 'content_page' | 'message_override',
  column: 'slug' | 'template',
  keys: string[],
) {
  let saved: Record<string, unknown>[] = [];
  beforeEach(async () => {
    saved = (
      await db().query<Record<string, unknown>>(
        `SELECT * FROM app.${table} WHERE ${column} = ANY($1::text[])`,
        [keys],
      )
    ).rows;
  });
  afterEach(async () => {
    await db().query('BEGIN');
    try {
      await db().query(`DELETE FROM app.${table} WHERE ${column} = ANY($1::text[])`, [keys]);
      await db().query(
        `INSERT INTO app.${table} SELECT * FROM json_populate_recordset(null::app.${table}, $1::json)`,
        [JSON.stringify(saved)],
      );
      await db().query('COMMIT');
    } catch (error) {
      await db().query('ROLLBACK');
      throw error;
    }
  });
}

export function restoreContentPages(db: () => pg.Client, slugs: string[]) {
  restoreContentRows(db, 'content_page', 'slug', slugs);
}

export function restoreContentTemplates(db: () => pg.Client, templates: string[]) {
  restoreContentRows(db, 'message_override', 'template', templates);
}
