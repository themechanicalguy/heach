import { readFileSync } from 'node:fs';
import type { ClientConfig } from 'pg';

/** TLS settings for PostgreSQL and Redis: verify the server against the data CA (EN-01.1). */
export function dataTls(env: { DATA_TLS_CA_FILE: string }): { ca: string; minVersion: 'TLSv1.2' } {
  return { ca: readFileSync(env.DATA_TLS_CA_FILE, 'utf8'), minVersion: 'TLSv1.2' };
}

/** Client settings with TLS verified against the data CA (EN-01.1). */
export function pgClientConfig(
  url: string,
  password: string | undefined,
  caFile: string,
): ClientConfig {
  return {
    connectionString: withPassword(url, password),
    ssl: { ...dataTls({ DATA_TLS_CA_FILE: caFile }), rejectUnauthorized: true },
  };
}

export function requireEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

/** pg lets values parsed from the URL override `password`, so the password goes into the URL. */
export function withPassword(url: string, password: string | undefined): string {
  if (!password) {
    return url;
  }
  const parsed = new URL(url);
  parsed.password = password;
  return parsed.toString();
}
