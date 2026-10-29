import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { createApp } from '../src/app.factory.js';

/** Boots the real app (same setup as main.ts) without listening on a port. */
export const WITH_DEFERRED_ROLES = {
  FEATURE_FLAGS: 'sample-patient-note,accounts,doctor-and-clinic',
};

export async function bootApp(
  nodeEnv = 'test',
  overrides: Record<string, string> = {},
): Promise<INestApplication<App>> {
  process.env.NODE_ENV = nodeEnv;
  process.env.API_PORT ??= '3001';
  process.env.APP_ENV = 'test';
  // The MVP set: roles deferred beyond the MVP (ADR 0015) are off unless a suite turns them on.
  process.env.FEATURE_FLAGS = 'sample-patient-note,accounts';
  process.env.RATE_LIMIT_PER_MINUTE = '10000';
  process.env.RATE_LIMIT_PER_ADDRESS_PER_MINUTE = '10000';
  // SMS stay in memory; OTP caps stay out of the way unless a test lowers one (SE-08).
  process.env.SMS_PROVIDER = 'fake';
  process.env.OTP_SENDS_PER_NUMBER_PER_HOUR = '1000';
  process.env.OTP_SENDS_PER_NUMBER_PER_DAY = '1000';
  process.env.OTP_SENDS_PER_DEVICE_PER_HOUR = '1000';
  process.env.OTP_SENDS_PER_ADDRESS_PER_HOUR = '100000';
  process.env.OTP_FAILURES_PER_ADDRESS_PER_HOUR = '100000';
  Object.assign(process.env, overrides);
  const app = await createApp({ logger: ['error'] });
  await app.init();
  return app as INestApplication<App>;
}
