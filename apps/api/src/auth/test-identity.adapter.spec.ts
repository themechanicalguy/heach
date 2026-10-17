import { assertTestLoginAllowed } from './test-identity.adapter.js';

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
