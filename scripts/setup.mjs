// First-run setup: creates .env from .env.example. Never overwrites existing values: if .env
// exists, only keys it is missing are appended, with their .env.example placeholder values.
import { appendFileSync, copyFileSync, existsSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { readEnv } from './lib/env-file.mjs';

if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  process.stdout.write('Created .env from .env.example.\n');
} else {
  const present = readEnv('.env');
  const example = readEnv('.env.example');
  const missing = Object.keys(example).filter((key) => !(key in present));
  if (missing.length > 0) {
    const ending = readFileSync('.env', 'utf8').endsWith('\n') ? '' : '\n';
    const lines = missing.map((key) => `${key}=${example[key] ?? ''}`).join('\n');
    appendFileSync('.env', `${ending}\n# Added by pnpm setup from .env.example\n${lines}\n`);
    process.stdout.write(`Added to .env from .env.example: ${missing.join(', ')}\n`);
  } else {
    process.stdout.write('.env is up to date.\n');
  }
}
