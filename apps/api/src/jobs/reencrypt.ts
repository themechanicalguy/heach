import 'reflect-metadata';
import type { EncryptedField, EnvelopeEncryptor } from '@heach/crypto';
import { createLogger } from '@heach/logger';
import { NestFactory } from '@nestjs/core';
import type pg from 'pg';
import { AppModule } from '../app.module.js';
import { validateEnv } from '../config/env.validate.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { loadSecrets } from '../secrets/load-secrets.js';

const BATCH = 100;

/**
 * Re-encrypts every `health` value not on the current data key version (EN-05.3). Today the only
 * such column is app.patient_note.body. Safe to re-run; each row is updated only if unchanged.
 * Runbook: docs/runbooks/key-rotation.md.
 */
export async function reencryptHealth(
  pool: Pick<pg.Pool, 'query'>,
  encryptor: EnvelopeEncryptor,
): Promise<number> {
  const current = await encryptor.currentKeyVersion('health');
  let done = 0;
  for (;;) {
    const { rows } = await pool.query<{ id: string; body: EncryptedField }>(
      `SELECT id, body FROM app.patient_note WHERE body ->> 'keyVersion' <> $1 LIMIT ${String(BATCH)}`,
      [current],
    );
    if (rows.length === 0) {
      return done;
    }
    for (const row of rows) {
      const fresh = await encryptor.encrypt(await encryptor.decrypt(row.body), 'health');
      await pool.query('UPDATE app.patient_note SET body = $2 WHERE id = $1 AND body = $3', [
        row.id,
        fresh,
        row.body,
      ]);
      done += 1;
    }
  }
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  await loadSecrets(process.env);
  const app = await NestFactory.createApplicationContext(
    AppModule.forEnv(validateEnv(process.env).APP_ENV),
    { logger: ['error'] },
  );
  const encryptor = app.get<EnvelopeEncryptor>(FIELD_ENCRYPTOR);
  if (process.argv.includes('--rotate')) {
    await encryptor.rotate('health');
  }
  const count = await reencryptHealth(app.get(PG_POOL), encryptor);
  createLogger({ name: 'jobs' }).info(
    { domain: 'health', reencrypted: count },
    'Re-encryption finished',
  );
  await app.close();
}
