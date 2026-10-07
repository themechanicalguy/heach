// Pre-commit: forbidden files, secrets, then format, lint and typecheck scoped to what is staged.
import process from 'node:process';
import { fail, output, run, step } from './run.mjs';
import { scanStaged } from './secrets.mjs';

const LINTABLE = /\.(ts|tsx|mjs|js)$/;
const WORKSPACE = /^((?:apps|packages)\/[^/]+)\/(.+)$/;

const staged = (output('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR']) ?? '')
  .split('\n')
  .filter(Boolean);
if (staged.length === 0) process.exit(0);

refuseEnvFiles(staged);
scanSecrets();
checkFormat(staged);
const workspaces = groupByWorkspace(staged.filter((file) => LINTABLE.test(file)));
lintStagedFiles(workspaces);
typecheckAffected([...workspaces.keys()].filter((dir) => dir !== '.'));

function refuseEnvFiles(files) {
  step('Checking for environment files');
  const envFiles = files.filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example'));
  if (envFiles.length > 0) {
    fail(
      `Refusing to commit environment files: ${envFiles.join(', ')}. Only .env.example is allowed.`,
    );
  }
}

function scanSecrets() {
  step('Scanning staged changes for secrets (gitleaks)');
  const clean = scanStaged();
  if (clean === null) fail('Secret scan needs Docker running (or gitleaks installed).');
  if (!clean) fail('Possible secret found (see above). Remove it; never commit credentials.');
}

function checkFormat(files) {
  step(`Checking formatting of ${String(files.length)} staged file(s) (Prettier)`);
  const args = ['exec', 'prettier', '--check', '--ignore-unknown', '--log-level', 'warn'];
  if (!run('pnpm', [...args, ...files])) fail('Formatting issues. Run: pnpm format');
}

/** Maps each workspace directory (or "." for root files) to its staged files, relative to it. */
function groupByWorkspace(files) {
  const groups = new Map();
  for (const file of files) {
    const match = WORKSPACE.exec(file);
    const [dir, relative] = match ? [match[1], match[2]] : ['.', file];
    groups.set(dir, [...(groups.get(dir) ?? []), relative]);
  }
  return groups;
}

/** ESLint on staged files only, run inside each workspace so its own config applies. */
function lintStagedFiles(groups) {
  for (const [dir, files] of groups) {
    step(`Linting ${String(files.length)} staged file(s) in ${dir === '.' ? 'root' : dir}`);
    if (!run('pnpm', ['exec', 'eslint', '--no-warn-ignored', ...files], dir)) {
      fail(`Lint failed in ${dir} (see above).`);
    }
  }
}

/** TypeScript checks whole projects, so typecheck each affected workspace and its dependents. */
function typecheckAffected(dirs) {
  if (dirs.length === 0) return;
  step(`Typechecking ${dirs.join(', ')} and their dependents`);
  const filters = dirs.map((dir) => `--filter=...{./${dir}}`);
  const args = ['exec', 'turbo', 'run', 'typecheck', ...filters, '--output-logs=errors-only'];
  if (!run('pnpm', args)) fail('Typecheck failed (see above).');
}
