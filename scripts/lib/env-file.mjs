// Minimal .env reader and in-place updater. Keeps comments and line order.
import { readFileSync, writeFileSync } from 'node:fs';

export function readEnv(path) {
  const values = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

/** Rewrites only the given keys; every other line is left exactly as it was. */
export function updateEnv(path, changes) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const updated = lines.map((line) => {
    const key = /^([A-Z0-9_]+)=/.exec(line)?.[1];
    return key && key in changes ? `${key}=${changes[key]}` : line;
  });
  writeFileSync(path, updated.join('\n'));
}
