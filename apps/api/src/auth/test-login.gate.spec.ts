import { type ExecutionContext, NotFoundException } from '@nestjs/common';
import type { EnvVars } from '../config/env.schema.js';
import { TestLoginGate } from './test-login.gate.js';

const KEY = 'k'.repeat(64);

function contextWith(key: string | undefined): ExecutionContext {
  const request = { header: (name: string) => (name === 'x-test-login-key' ? key : undefined) };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const gate = (env: Partial<EnvVars>) => new TestLoginGate(env as EnvVars);

describe('TestLoginGate', () => {
  it('SE-07.23 refuses a dev request without the key with 404, as if the route did not exist', () => {
    expect(() =>
      gate({ APP_ENV: 'dev', TEST_LOGIN_KEY: KEY }).canActivate(contextWith(undefined)),
    ).toThrow(NotFoundException);
    expect(() => gate({ APP_ENV: 'dev' }).canActivate(contextWith(KEY))).toThrow(NotFoundException);
  });

  it('SE-07.23 lets a dev request with the key through', () => {
    expect(gate({ APP_ENV: 'dev', TEST_LOGIN_KEY: KEY }).canActivate(contextWith(KEY))).toBe(true);
  });
});
