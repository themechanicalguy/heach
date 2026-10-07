// Points git at the repository's hooks in .githooks. Runs on pnpm install (prepare) and
// pnpm setup. Does nothing outside a git checkout (for example inside a Docker build).
import { existsSync } from 'node:fs';
import process from 'node:process';
import { output } from './run.mjs';

export function installHooks() {
  if (!existsSync('.git')) return;
  if (output('git', ['config', '--get', 'core.hooksPath'])?.trim() === '.githooks') return;
  if (output('git', ['config', 'core.hooksPath', '.githooks']) !== null) {
    process.stdout.write(
      'Git hooks installed from .githooks (pre-commit, commit-msg, pre-push).\n',
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) installHooks();
