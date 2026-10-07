// Picks a free port for every local service and app, and keeps .env consistent with it.
import { URL } from 'node:url';
import { isPortFree, portsOwnedByCompose } from './ports.mjs';
import { readEnv, updateEnv } from './env-file.mjs';

/** Port keys in .env, their defaults, and the URL keys whose port must follow them. */
export const PORTS = [
  { key: 'POSTGRES_PORT', fallback: 5433, url: 'DATABASE_URL', label: 'PostgreSQL' },
  { key: 'REDIS_PORT', fallback: 6379, url: 'REDIS_URL', label: 'Redis' },
  { key: 'S3_PORT', fallback: 8333, url: 'S3_ENDPOINT', label: 'S3 store' },
  { key: 'SMTP_PORT', fallback: 1025, label: 'Mailpit SMTP' },
  { key: 'MAILPIT_UI_PORT', fallback: 8025, label: 'Mailpit inbox' },
  { key: 'API_PORT', fallback: 3001, label: 'API' },
  { key: 'WEB_PORT', fallback: 3000, label: 'Web' },
  { key: 'ADMIN_PORT', fallback: 5173, label: 'Admin' },
];

const MAX_TRIES = 50;

/** Returns { port per key } and rewrites .env for any port that had to move. */
export async function resolvePorts(envPath) {
  const env = readEnv(envPath);
  const owned = portsOwnedByCompose();
  const taken = new Set();
  const changes = {};
  const moves = [];
  for (const { key, fallback, url, label } of PORTS) {
    const wanted = Number(env[key] ?? fallback);
    const port = await firstFreePort(wanted, owned, taken);
    taken.add(port);
    if (port === wanted) continue;
    moves.push(`${label}: ${String(wanted)} is in use, using ${String(port)}`);
    changes[key] = String(port);
    if (url && env[url]) changes[url] = withPort(env[url], port);
  }
  if (moves.length > 0) updateEnv(envPath, changes);
  return { moves, env: readEnv(envPath) };
}

async function firstFreePort(start, owned, taken) {
  for (let port = start; port < start + MAX_TRIES; port += 1) {
    if (taken.has(port)) continue;
    if (owned.has(port) || (await isPortFree(port))) return port;
  }
  throw new Error(`No free port between ${String(start)} and ${String(start + MAX_TRIES - 1)}`);
}

function withPort(value, port) {
  const url = new URL(value);
  url.port = String(port);
  return url.toString().replace(/\/$/, value.endsWith('/') ? '/' : '');
}
