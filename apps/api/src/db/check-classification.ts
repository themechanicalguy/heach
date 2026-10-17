import 'reflect-metadata';
import pg from 'pg';
import { pgClientConfig, requireEnv } from './connection.js';

export const DATA_CLASSES = ['Restricted', 'Confidential', 'Internal', 'Public'] as const;

export interface ClassificationProblem {
  column: string;
  problem: string;
}

/**
 * Every column in the given schemas must carry `class=<class>` as its comment (DC-01.1), and every
 * Restricted column must use app.encrypted_field, the shape written by @heach/crypto (DC-01.2).
 */
export async function checkClassification(
  client: Pick<pg.Client, 'query'>,
  schemas: readonly string[] = ['app', 'audit'],
): Promise<ClassificationProblem[]> {
  const { rows } = await client.query<{
    col: string;
    comment: string | null;
    domain: string | null;
  }>(
    `SELECT c.table_schema || '.' || c.table_name || '.' || c.column_name AS col,
            col_description((quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass, c.ordinal_position) AS comment,
            c.domain_schema || '.' || c.domain_name AS domain
       FROM information_schema.columns c
       JOIN information_schema.tables t USING (table_schema, table_name)
      WHERE c.table_schema = ANY($1) AND t.table_type = 'BASE TABLE'
      ORDER BY 1`,
    [schemas],
  );
  return rows.flatMap((row) => problemsFor(row.col, row.comment, row.domain));
}

function problemsFor(
  column: string,
  comment: string | null,
  domain: string | null,
): ClassificationProblem[] {
  const dataClass = /^class=(\w+)/.exec(comment ?? '')?.[1];
  if (!dataClass || !(DATA_CLASSES as readonly string[]).includes(dataClass)) {
    return [{ column, problem: "no data class tag (COMMENT ON COLUMN ... IS 'class=<class>')" }];
  }
  if (dataClass === 'Restricted' && domain !== 'app.encrypted_field') {
    return [
      { column, problem: 'Restricted but not stored as app.encrypted_field through @heach/crypto' },
    ];
  }
  return [];
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  const client = new pg.Client(
    pgClientConfig(
      requireEnv(process.env, 'DATABASE_MIGRATOR_URL'),
      process.env.DATABASE_MIGRATOR_PASSWORD,
      requireEnv(process.env, 'DATA_TLS_CA_FILE'),
    ),
  );
  await client.connect();
  const problems = await checkClassification(client);
  await client.end();
  for (const { column, problem } of problems) {
    process.stderr.write(`${column}: ${problem}\n`);
  }
  process.exitCode = problems.length > 0 ? 1 : 0;
}
