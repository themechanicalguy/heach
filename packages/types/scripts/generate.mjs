// Regenerates openapi.json and src/generated/api.ts from apps/api.
// `--check` regenerates into a temp folder and fails if the committed files are stale.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const check = process.argv.includes('--check');
const run = (cmd, args, cwd = '.') => execFileSync(cmd, args, { cwd, stdio: 'inherit' });
const targets = { json: 'openapi.json', types: 'src/generated/api.ts' };

const tmp = mkdtempSync(join(tmpdir(), 'heach-types-'));
const out = { json: join(tmp, 'openapi.json'), types: join(tmp, 'api.ts') };
try {
  // The API's build needs its runtime packages, not this one (only its tests import it).
  run('pnpm', ['--filter', '@heach/api...', '--filter', '!@heach/types', 'build'], '../..');
  run('node', ['dist/openapi.export.js', out.json], '../../apps/api');
  run('pnpm', ['exec', 'openapi-typescript', out.json, '-o', out.types]);
  // Temp files sit outside the repo, so pass the repo's Prettier config explicitly.
  const prettierConfig = ['--config', '../../prettier.config.mjs'];
  run('pnpm', [
    'exec',
    'prettier',
    ...prettierConfig,
    '--write',
    '--log-level',
    'warn',
    out.json,
    out.types,
  ]);

  const stale = Object.keys(targets).filter(
    (key) => readFileSync(out[key], 'utf8') !== readSafe(targets[key]),
  );
  if (check) {
    if (stale.length > 0) {
      process.stderr.write(
        `Stale generated API types: ${stale.map((k) => targets[k]).join(', ')}.\n` +
          'Run `pnpm --filter @heach/types generate` and commit the result.\n',
      );
      process.exitCode = 1;
    } else {
      process.stdout.write('Generated API types are up to date.\n');
    }
  } else {
    for (const key of Object.keys(targets)) copyFileSync(out[key], targets[key]);
    process.stdout.write(`Updated ${Object.values(targets).join(', ')}.\n`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

function readSafe(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}
