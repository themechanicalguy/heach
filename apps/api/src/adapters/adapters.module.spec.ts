import type { EnvVars } from '../config/env.schema.js';
import { createSmsSender, testDouble } from './adapters.module.js';
import { FakeSmsSender } from './fakes.js';
import { MailpitSmsSender } from './mailpit-sms.adapter.js';

const base = { MAILPIT_API_URL: 'https://mailpit.test' };

describe('createSmsSender', () => {
  it('uses the in-memory double when configured, but never in staging or production', () => {
    const env = { ...base, SMS_PROVIDER: 'fake', APP_ENV: 'test' } as EnvVars;
    expect(createSmsSender(env)).toBeInstanceOf(FakeSmsSender);
    for (const appEnv of ['staging', 'production']) {
      expect(() =>
        createSmsSender({ ...base, SMS_PROVIDER: 'fake', APP_ENV: appEnv } as EnvVars),
      ).toThrow(/test doubles run only/);
    }
  });

  it('L-8 allows the Mailpit inbox locally, in tests and on dev, never in staging or production', () => {
    for (const appEnv of ['local', 'test', 'dev']) {
      expect(
        createSmsSender({ ...base, SMS_PROVIDER: 'local', APP_ENV: appEnv } as EnvVars),
      ).toBeInstanceOf(MailpitSmsSender);
    }
    for (const appEnv of ['staging', 'production']) {
      expect(() =>
        createSmsSender({ ...base, SMS_PROVIDER: 'local', APP_ENV: appEnv } as EnvVars),
      ).toThrow(/not allowed/);
    }
  });
});

describe('testDouble', () => {
  it('SO-03 test doubles (payments, identity, scanner, storage, video) refuse staging and production', () => {
    for (const appEnv of ['local', 'test', 'dev'] as const) {
      expect(testDouble({ APP_ENV: appEnv }, 'payment gateway', () => 'double')).toBe('double');
    }
    for (const appEnv of ['staging', 'production'] as const) {
      expect(() => testDouble({ APP_ENV: appEnv }, 'payment gateway', () => 'double')).toThrow(
        `No payment gateway adapter for ${appEnv}`,
      );
    }
  });
});
