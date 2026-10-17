import 'reflect-metadata';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.factory.js';
import { buildOpenApiDocument } from './openapi.js';

/**
 * Writes the OpenAPI document to the path given as the first argument, without listening.
 * Used by `pnpm --filter @heach/types generate`. The version is fixed so the file only changes
 * when the API contract changes.
 */
const outFile = process.argv[2];
if (!outFile) {
  throw new Error('Usage: node dist/openapi.export.js <output.json>');
}
process.env.NODE_ENV = 'development';
process.env.API_PORT ??= '3001';
// Building the document never touches the data stores; these only satisfy env validation.
process.env.DATABASE_URL = 'postgresql://openapi-export@127.0.0.1:1/none';
process.env.REDIS_URL = 'rediss://127.0.0.1:1/0';
process.env.APP_ENV = 'test';
process.env.KEY_PROVIDER = 'local';
process.env.LOCAL_KEY_SEED = 'openapi-export-never-encrypts-anything';
process.env.BLIND_INDEX_KEY = '0'.repeat(64);
const emptyCa = join(mkdtempSync(join(tmpdir(), 'openapi-')), 'ca.crt');
writeFileSync(emptyCa, '');
process.env.DATA_TLS_CA_FILE = emptyCa;

const app = await createApp({ logger: false });
writeFileSync(outFile, `${JSON.stringify(buildOpenApiDocument(app, 'contract'), null, 2)}\n`);
await app.close();
