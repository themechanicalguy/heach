import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EnvVars } from './env.schema.js';

/**
 * Parses and validates environment variables, throwing on the first problem so the process
 * fails fast. Error text names the variables only, never their values.
 */
export function validateEnv(raw: Record<string, string | undefined>): EnvVars {
  const env = plainToInstance(EnvVars, raw);
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const names = errors.map((error) => error.property).join(', ');
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }
  return env;
}
