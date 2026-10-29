import 'reflect-metadata';
import { createLogger } from '@heach/logger';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { validateEnv } from '../config/env.validate.js';
import { apiSecrets, loadSecrets } from '../secrets/load-secrets.js';
import { JobRunner } from './runner/job-runner.js';

const logger = createLogger({ name: 'jobs' });
const POLL_MS = 5_000;

/** The background worker: the API's modules without HTTP, running due jobs every few seconds. */
async function main(): Promise<void> {
  await loadSecrets(process.env, apiSecrets(process.env.APP_ENV));
  const app = await NestFactory.createApplicationContext(
    AppModule.forEnv(validateEnv(process.env).APP_ENV),
    {
      logger: false,
    },
  );
  app.enableShutdownHooks();
  const runner = app.get(JobRunner);
  logger.info('Worker started');
  for (;;) {
    const ran = await runner.runDue().catch(() => 0);
    if (ran === 0) await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) await main();
