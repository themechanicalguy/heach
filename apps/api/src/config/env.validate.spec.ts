import { NodeEnv } from './env.schema.js';
import { validateEnv } from './env.validate.js';

describe('validateEnv', () => {
  it('returns typed values for a valid environment', () => {
    const env = validateEnv({ NODE_ENV: 'test', API_PORT: '3001' });

    expect(env.NODE_ENV).toBe(NodeEnv.Test);
    expect(env.API_PORT).toBe(3001);
  });

  it('fails fast naming each missing variable, without values', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging-secret' })).toThrow(
      'Invalid or missing environment variables: NODE_ENV, API_PORT',
    );
  });
});
