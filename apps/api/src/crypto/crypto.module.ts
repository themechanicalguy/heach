import { KMSClient } from '@aws-sdk/client-kms';
import {
  BlindIndexer,
  deriveBlindIndexKeys,
  EnvelopeEncryptor,
  type KeyProvider,
  LocalKeyProvider,
} from '@heach/crypto';
import { Global, Module } from '@nestjs/common';
import type pg from 'pg';
import { EnvVars } from '../config/env.schema.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { BLIND_INDEXER, FIELD_ENCRYPTOR } from './crypto.tokens.js';
import { KmsKeyProvider } from './kms-key-provider.js';
import { PgDataKeyStore } from './pg-data-key-store.js';

const LOCAL_KEYS_ALLOWED = new Set(['local', 'test']);

export function createKeyProvider(env: EnvVars): KeyProvider {
  if (env.KEY_PROVIDER === 'kms' && env.KMS_ALIAS_PREFIX) {
    return new KmsKeyProvider(new KMSClient({}), env.KMS_ALIAS_PREFIX);
  }
  if (env.KEY_PROVIDER === 'local' && LOCAL_KEYS_ALLOWED.has(env.APP_ENV)) {
    return new LocalKeyProvider(env.LOCAL_KEY_SEED);
  }
  throw new Error(`Key provider ${env.KEY_PROVIDER} is not allowed in ${env.APP_ENV}`);
}

/** Envelope encryption backed by KMS (or its local test double) and the `data_key` table. */
@Global()
@Module({
  providers: [
    {
      provide: FIELD_ENCRYPTOR,
      inject: [EnvVars, PG_POOL],
      useFactory: (env: EnvVars, pool: pg.Pool) =>
        new EnvelopeEncryptor(createKeyProvider(env), new PgDataKeyStore(pool)),
    },
    {
      provide: BLIND_INDEXER,
      inject: [EnvVars],
      useFactory: (env: EnvVars) =>
        new BlindIndexer(deriveBlindIndexKeys(Buffer.from(env.BLIND_INDEX_KEY, 'hex'))),
    },
  ],
  exports: [FIELD_ENCRYPTOR, BLIND_INDEXER],
})
export class CryptoModule {}
