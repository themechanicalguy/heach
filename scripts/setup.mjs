// First-run setup: creates .env from .env.example if it does not exist. Never overwrites .env.
// If .env already exists, lists any keys from .env.example that it is missing.
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import process from 'node:process';

const keysOf = (file) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => /^([A-Z0-9_]+)=/.exec(line)?.[1])
    .filter(Boolean);

if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  process.stdout.write('Created .env from .env.example.\n');
} else {
  const present = new Set(keysOf('.env'));
  const missing = keysOf('.env.example').filter((key) => !present.has(key));
  if (missing.length > 0) {
    process.stderr.write(
      `.env is missing: ${missing.join(', ')}.\n` +
        'Copy them from .env.example (or delete .env and run pnpm setup again).\n',
    );
    process.exitCode = 1;
  } else {
    process.stdout.write('.env is up to date.\n');
  }
}
