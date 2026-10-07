// First-run setup: creates .env from .env.example if it does not exist. Never overwrites .env.
import { copyFileSync, existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.stdout.write('.env already exists; left unchanged.\n');
} else {
  copyFileSync('.env.example', '.env');
  process.stdout.write('Created .env from .env.example. Fill in any blank values you need.\n');
}
