import 'reflect-metadata';
import { createLogger } from '@heach/logger';
import { createApp } from './app.factory.js';
import { EnvVars } from './config/env.schema.js';

const logger = createLogger({ name: 'api' });
const app = await createApp();
const env = app.get(EnvVars);
await app.listen(env.API_PORT);
logger.info(
  { port: env.API_PORT, version: env.BUILD_VERSION ?? 'dev', env: env.NODE_ENV },
  'API listening',
);
