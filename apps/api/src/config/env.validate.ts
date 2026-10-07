import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EnvVars } from './env.schema.js';

/**
 * Parses and validates environment variables, throwing on the first problem so the process
 * fails fast. Empty values count as unset, so `KEY=` in .env behaves like a missing key.
 * Error text names the variables only, never their values.
 */
export function validateEnv(raw: Record<string, string | undefined>): EnvVars {
  const env = plainToInstance(EnvVars, withoutEmptyValues(raw));
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const names = errors.map((error) => error.property).join(', ');
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }
  return env;
}

function withoutEmptyValues(raw: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, string] => Boolean(entry[1]?.trim())),
  );
}
