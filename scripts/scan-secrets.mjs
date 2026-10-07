// pnpm secrets:scan — scans the whole git history for secrets, as CI does.
import process from 'node:process';
import { gitleaks } from './hooks/secrets.mjs';

const result = gitleaks([]);
if (result === null) process.stderr.write('Needs Docker running (or gitleaks installed).\n');
process.exitCode = result ? 0 : 1;
