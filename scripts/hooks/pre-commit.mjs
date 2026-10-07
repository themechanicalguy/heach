// Pre-commit: secrets, forbidden files, formatting, then lint and typecheck of affected packages.
import process from 'node:process';
import { fail, output, run, step } from './run.mjs';
import { scanStaged } from './secrets.mjs';

const staged = (output('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR']) ?? '')
  .split('\n')
  .filter(Boolean);
if (staged.length === 0) process.exit(0);

step('Checking for environment files');
const envFiles = staged.filter(
  (file) => /(^|\/)\.env(\.|$)/.test(file) && !file.endsWith('.env.example'),
);
if (envFiles.length > 0) {
  fail(
    `Refusing to commit environment files: ${envFiles.join(', ')}. Only .env.example is allowed.`,
  );
}

step('Scanning staged changes for secrets (gitleaks)');
const secrets = scanStaged();
if (secrets === null)
  fail('Secret scan needs Docker running (or gitleaks installed). Start Docker Desktop.');
if (!secrets) fail('Possible secret found (see above). Remove it; never commit credentials.');

step('Checking formatting (Prettier)');
if (
  !run('pnpm', [
    'exec',
    'prettier',
    '--check',
    '--ignore-unknown',
    '--log-level',
    'warn',
    ...staged,
  ])
) {
  fail('Formatting issues. Run: pnpm format');
}

step('Lint and typecheck of changed packages');
if (
  !run('pnpm', [
    'exec',
    'turbo',
    'run',
    'lint',
    'typecheck',
    '--filter=...[HEAD]',
    '--output-logs=errors-only',
  ])
) {
  fail('Lint or typecheck failed (see above).');
}
