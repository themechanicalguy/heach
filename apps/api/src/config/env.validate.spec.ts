import { NodeEnv } from './env.schema.js';
import { validateEnv } from './env.validate.js';

const STORES = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379/0',
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
      'Invalid or missing environment variables: NODE_ENV, API_PORT, DATABASE_URL, REDIS_URL',
    );
  });

  it('rejects data store URLs with the wrong scheme', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'test',
        API_PORT: '3001',
        DATABASE_URL: 'mysql://x',
        REDIS_URL: 'memcached://x',
      }),
    ).toThrow('Invalid or missing environment variables: DATABASE_URL, REDIS_URL');
  });
});
