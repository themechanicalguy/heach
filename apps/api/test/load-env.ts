import { existsSync } from 'node:fs';

// Integration tests run against the real local services. Locally the values come from the
// repository .env (pnpm setup); in CI the workflow sets them as environment variables.
const envFile = new URL('../../../.env', import.meta.url);
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
