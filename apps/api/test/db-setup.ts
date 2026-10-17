import { bootstrapDatabase } from '../src/db/bootstrap.js';
import { migrate } from '../src/db/migrate.js';

/** Integration tests start from a bootstrapped, fully migrated database, as a deploy does. */
export default async function setup(): Promise<void> {
  const env = process.env;
  const envFile = new URL('../../../.env', import.meta.url);
  try {
    process.loadEnvFile(envFile);
  } catch {
    // CI sets the variables directly.
  }
  await bootstrapDatabase(env);
  await migrate(env);
}
