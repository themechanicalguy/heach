import type pg from 'pg';

const QUERIES = {
  content_page: {
    read: 'SELECT * FROM app.content_page WHERE slug = ANY($1::text[])',
    remove: 'DELETE FROM app.content_page WHERE slug = ANY($1::text[])',
    insert:
      'INSERT INTO app.content_page SELECT * FROM json_populate_recordset(null::app.content_page, $1::json)',
  },
  message_override: {
    read: 'SELECT * FROM app.message_override WHERE template = ANY($1::text[])',
    remove: 'DELETE FROM app.message_override WHERE template = ANY($1::text[])',
    insert:
      'INSERT INTO app.message_override SELECT * FROM json_populate_recordset(null::app.message_override, $1::json)',
  },
} as const;

/** Snapshot only the Public content keys a suite mutates; restore even after a failed assertion. */
function restoreContentRows(
  db: () => pg.Client,
  table: 'content_page' | 'message_override',
  keys: string[],
) {
  const queries = QUERIES[table];
  let saved: Record<string, unknown>[] = [];
  beforeEach(async () => {
    saved = (await db().query<Record<string, unknown>>(queries.read, [keys])).rows;
  });
  afterEach(async () => {
    await db().query('BEGIN');
    try {
      await db().query(queries.remove, [keys]);
      await db().query(queries.insert, [JSON.stringify(saved)]);
      await db().query('COMMIT');
    } catch (error) {
      await db().query('ROLLBACK');
      throw error;
    }
  });
}

export function restoreContentPages(db: () => pg.Client, slugs: string[]) {
  restoreContentRows(db, 'content_page', slugs);
}

export function restoreContentTemplates(db: () => pg.Client, templates: string[]) {
  restoreContentRows(db, 'message_override', templates);
}
