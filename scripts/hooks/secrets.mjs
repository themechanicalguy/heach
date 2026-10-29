// Secret scanning with gitleaks: a local install if present, otherwise the pinned Docker image.
import process from 'node:process';
import { output, run } from './run.mjs';

// Pinned by digest so a re-pushed tag cannot change what runs.
export const GITLEAKS_IMAGE =
  'zricethezav/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
const COMMON = ['--redact', '--no-banner', '--exit-code', '1'];

/**
 * In a git worktree, `.git` is a file naming a directory inside the main checkout's `.git`. The
 * container then needs that common directory too, read-only at the same absolute path, or git
 * inside it finds no repository.
 */
export function worktreeMounts(cwd, commonDir) {
  const common = commonDir?.trim();
  if (!common || common.startsWith(`${cwd}/`)) return [];
  return ['-v', `${common}:${common}:ro`];
}

/** Runs `gitleaks git <args>` on this repo. Returns true if clean, false on findings, null if unavailable. */
export function gitleaks(args) {
  const all = ['git', ...args, ...COMMON];
  if (output('gitleaks', ['version']) !== null) return run('gitleaks', [...all, '.']);
  if (output('docker', ['info']) === null) return null;
  const script = `git config --global --add safe.directory /repo && gitleaks ${all.join(' ')} /repo`;
  return run('docker', [
    'run',
    '--rm',
    '--network',
    'none',
    '-v',
    `${process.cwd()}:/repo:ro`,
    ...worktreeMounts(
      process.cwd(),
      output('git', ['rev-parse', '--path-format=absolute', '--git-common-dir']),
    ),
    '-w',
    '/repo',
    '--entrypoint',
    'sh',
    GITLEAKS_IMAGE,
    '-c',
    script,
  ]);
}

/** Scans only what is staged for commit. */
export const scanStaged = () => gitleaks(['--pre-commit', '--staged']);
