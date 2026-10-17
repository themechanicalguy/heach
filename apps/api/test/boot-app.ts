import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { createApp } from '../src/app.factory.js';

/** Boots the real app (same setup as main.ts) without listening on a port. */
export async function bootApp(
  nodeEnv = 'test',
  overrides: Record<string, string> = {},
): Promise<INestApplication<App>> {
  process.env.NODE_ENV = nodeEnv;
  process.env.API_PORT ??= '3001';
  process.env.APP_ENV = 'test';
  process.env.FEATURE_FLAGS = 'sample-patient-note';
  process.env.RATE_LIMIT_PER_MINUTE = '10000';
  Object.assign(process.env, overrides);
  const app = await createApp({ logger: ['error'] });
  await app.init();
  return app as INestApplication<App>;
}
