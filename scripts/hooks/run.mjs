// Shared helpers for the git hooks.
import { execFileSync, spawnSync } from 'node:child_process';
import process from 'node:process';

/** Runs a command with inherited output; returns true when it exits 0. */
export function run(cmd, args, cwd = '.') {
  return spawnSync(cmd, args, { stdio: 'inherit', cwd }).status === 0;
}

/** Runs a command and returns its stdout, or null if it fails. */
export function output(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

export function fail(message) {
  process.stderr.write(`\n✖ ${message}\n\n`);
  process.exit(1);
}

export function step(message) {
  process.stdout.write(`› ${message}\n`);
}
