// First-run setup: creates .env from .env.example. Never overwrites existing values: if .env
// exists, only keys it is missing are appended, with their .env.example placeholder values.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { installHooks } from './hooks/install.mjs';
import { readEnv, updateEnv } from './lib/env-file.mjs';
import { generatedValue, makeLocalCerts } from './lib/generated-values.mjs';

installHooks();
const caFile = makeLocalCerts();
const fill = (text) =>
  text.replace(
    /^(\w+)=(<generate:[\w-]+>)$/gm,
    (_, key, value) => `${key}=${generatedValue(value, caFile)}`,
  );

if (!existsSync('.env')) {
  writeFileSync('.env', fill(readFileSync('.env.example', 'utf8')), { mode: 0o600 });
  process.stdout.write('Created .env from .env.example.\n');
} else {
  const present = readEnv('.env');
  const example = readEnv('.env.example');
  const missing = Object.keys(example).filter((key) => !(key in present));
  if (missing.length > 0) {
    const ending = readFileSync('.env', 'utf8').endsWith('\n') ? '' : '\n';
    const lines = missing
      .map((key) => `${key}=${generatedValue(example[key] ?? '', caFile)}`)
      .join('\n');
    appendFileSync('.env', `${ending}\n# Added by pnpm setup from .env.example\n${lines}\n`);
    process.stdout.write(`Added to .env from .env.example: ${missing.join(', ')}\n`);
  } else {
    process.stdout.write('.env is up to date.\n');
  }
}

// Step 2 moved the API to its own database role and to TLS (EN-01.1, EN-10.2). Upgrade .env
// files made before that; anything else the developer changed is left alone.
const current = readEnv('.env');
const example = readEnv('.env.example');
const upgrades = {};
if (current.REDIS_URL?.startsWith('redis://'))
  upgrades.REDIS_URL = current.REDIS_URL.replace('redis://', 'rediss://');
if (current.DATABASE_URL === current.DATABASE_ADMIN_URL)
  upgrades.DATABASE_URL = example.DATABASE_URL;
if (Object.keys(upgrades).length > 0) {
  updateEnv('.env', upgrades);
  process.stdout.write(`Upgraded in .env for Step 2: ${Object.keys(upgrades).join(', ')}\n`);
}
