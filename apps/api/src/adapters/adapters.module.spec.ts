import type { EnvVars } from '../config/env.schema.js';
import { createSmsSender } from './adapters.module.js';
import { FakeSmsSender } from './fakes.js';
import { MailpitSmsSender } from './mailpit-sms.adapter.js';

const base = { MAILPIT_API_URL: 'https://mailpit.test' };

describe('createSmsSender', () => {
  it('uses the in-memory double when configured', () => {
    const env = { ...base, SMS_PROVIDER: 'fake', APP_ENV: 'production' } as EnvVars;
    expect(createSmsSender(env)).toBeInstanceOf(FakeSmsSender);
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
