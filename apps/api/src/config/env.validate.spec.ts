import { NodeEnv } from './env.schema.js';
import { validateEnv } from './env.validate.js';

const STORES = {
  APP_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'rediss://localhost:6379/0',
  DATA_TLS_CA_FILE: '/certs/ca.crt',
  KEY_PROVIDER: 'local',
  LOCAL_KEY_SEED: 'x'.repeat(32),
  BLIND_INDEX_KEY: 'a'.repeat(64),
};

describe('validateEnv', () => {
  it('returns typed values for a valid environment', () => {
    const env = validateEnv({ NODE_ENV: 'test', API_PORT: '3001', ...STORES });

    expect(env.NODE_ENV).toBe(NodeEnv.Test);
    expect(env.API_PORT).toBe(3001);
  });

  it('treats empty values as unset', () => {
    const env = validateEnv({ NODE_ENV: 'test', API_PORT: '3001', BUILD_VERSION: '', ...STORES });

    expect(env.BUILD_VERSION).toBeUndefined();
  });

  it('reports a required variable left empty as missing', () => {
    expect(() => validateEnv({ NODE_ENV: 'test', API_PORT: ' ', ...STORES })).toThrow(
      'Invalid or missing environment variables: API_PORT',
    );
  });

  it('fails fast naming each missing variable, without values', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging-secret' })).toThrow(
      'Invalid or missing environment variables: NODE_ENV, APP_ENV, API_PORT, DATABASE_URL, REDIS_URL, DATA_TLS_CA_FILE, KEY_PROVIDER, BLIND_INDEX_KEY',
    );
  });

  it('rejects data store URLs with the wrong scheme', () => {
    expect(() =>
      validateEnv({
        ...STORES,
        NODE_ENV: 'test',
        API_PORT: '3001',
        DATABASE_URL: 'mysql://x',
        REDIS_URL: 'memcached://x',
      }),
    ).toThrow('Invalid or missing environment variables: DATABASE_URL, REDIS_URL');
  });

  it('EN-01.1 refuses plaintext Redis and TLS overrides in the database URL', () => {
    expect(() =>
      validateEnv({
        ...STORES,
        NODE_ENV: 'test',
        API_PORT: '3001',
        DATABASE_URL: 'postgresql://u@h/db?sslmode=disable',
        REDIS_URL: 'redis://localhost:6379/0',
      }),
    ).toThrow('Invalid or missing environment variables: DATABASE_URL, REDIS_URL');
  });

  it('requires a KMS alias prefix when the key provider is KMS', () => {
    expect(() =>
      validateEnv({ ...STORES, NODE_ENV: 'test', API_PORT: '3001', KEY_PROVIDER: 'kms' }),
    ).toThrow('Invalid or missing environment variables: KMS_ALIAS_PREFIX');
  });
});
