import 'reflect-metadata';
import { createApp } from './app.factory.js';
import { appLogger as logger } from './common/app-logger.js';
import { EnvVars } from './config/env.schema.js';
import { apiSecrets, loadSecrets } from './secrets/load-secrets.js';

await loadSecrets(process.env, apiSecrets(process.env.APP_ENV));
const app = await createApp();
const env = app.get(EnvVars);
await app.listen(env.API_PORT);
logger.info(
  { port: env.API_PORT, version: env.BUILD_VERSION ?? 'dev', env: env.NODE_ENV },
  'API listening',
);
