import 'reflect-metadata';
import { createApp } from './app.factory.js';
import { EnvVars } from './config/env.schema.js';

const app = await createApp();
await app.listen(app.get(EnvVars).API_PORT);
