import { randomBytes } from 'node:crypto';
import { assertTestLoginAllowed, testLoginPermitted } from './test-identity.adapter.js';

const KEY = randomBytes(32).toString('hex');

describe('Test identity adapter', () => {
  it('SE-07.4 is refused at start-up outside test and dev', () => {
    expect(() => {
      assertTestLoginAllowed('staging');
    }).toThrow(/refused in staging/);
    expect(() => {
      assertTestLoginAllowed('production');
    }).toThrow(/refused in production/);
  });

  it('SE-07.4 is allowed in local, test and dev', () => {
    for (const env of ['local', 'test', 'dev'] as const) {
      expect(() => {
        assertTestLoginAllowed(env);
      }).not.toThrow();
    }
  });
});

describe('testLoginPermitted (SE-07.23)', () => {
  it('SE-07.23 the dev host without a configured key refuses every request', () => {
    expect(testLoginPermitted('dev', undefined, undefined)).toBe(false);
    expect(testLoginPermitted('dev', undefined, KEY)).toBe(false);
  });

  it('SE-07.23 the dev host requires the exact configured key', () => {
    expect(testLoginPermitted('dev', KEY, KEY)).toBe(true);
    expect(testLoginPermitted('dev', KEY, undefined)).toBe(false);
    expect(testLoginPermitted('dev', KEY, '')).toBe(false);
    expect(testLoginPermitted('dev', KEY, `${KEY}x`)).toBe(false);
    expect(testLoginPermitted('dev', KEY, KEY.slice(1))).toBe(false);
    expect(testLoginPermitted('dev', KEY, randomBytes(32).toString('hex'))).toBe(false);
  });

  it('SE-07.23 local and test runs stay open for synthetic users without a key', () => {
    expect(testLoginPermitted('local', undefined, undefined)).toBe(true);
    expect(testLoginPermitted('test', undefined, undefined)).toBe(true);
  });

  it('SE-07.23 a configured key is required in any environment', () => {
    for (const env of ['local', 'test'] as const) {
      expect(testLoginPermitted(env, KEY, undefined)).toBe(false);
      expect(testLoginPermitted(env, KEY, KEY)).toBe(true);
    }
  });

  it('SE-07.23 staging and production never permit it, key or not', () => {
    // The module also refuses to start there (SE-07.4); this is the second lock.
    for (const env of ['staging', 'production'] as const) {
      expect(testLoginPermitted(env, undefined, undefined)).toBe(false);
      expect(testLoginPermitted(env, KEY, KEY)).toBe(false);
    }
  });
});
