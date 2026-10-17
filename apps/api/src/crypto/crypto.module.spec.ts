import { LocalKeyProvider } from '@heach/crypto';
import type { EnvVars } from '../config/env.schema.js';
import { createKeyProvider } from './crypto.module.js';
import { KmsKeyProvider } from './kms-key-provider.js';

const base = { LOCAL_KEY_SEED: 'x'.repeat(32), KMS_ALIAS_PREFIX: 'alias/heach-dev' };

describe('createKeyProvider', () => {
  it('uses KMS when configured', () => {
    const env = { ...base, KEY_PROVIDER: 'kms', APP_ENV: 'dev' } as EnvVars;
    expect(createKeyProvider(env)).toBeInstanceOf(KmsKeyProvider);
  });

  it('allows the local test double only locally and in tests', () => {
    expect(
      createKeyProvider({ ...base, KEY_PROVIDER: 'local', APP_ENV: 'test' } as EnvVars),
    ).toBeInstanceOf(LocalKeyProvider);
    for (const appEnv of ['dev', 'staging', 'production']) {
      expect(() =>
        createKeyProvider({ ...base, KEY_PROVIDER: 'local', APP_ENV: appEnv } as EnvVars),
      ).toThrow(/not allowed/);
    }
  });
});
