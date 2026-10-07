// pre-push: blocks pushing to main. GitHub Free has no branch protection for private repos,
// so this local check keeps every change going through a pull request and CI.
// Emergency override (say why in the PR or commit): HEACH_ALLOW_MAIN_PUSH=1 git push
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { fail } from './run.mjs';

const PROTECTED = 'refs/heads/main';
const updates = readFileSync(0, 'utf8').split('\n').filter(Boolean);
const toMain = updates.some((line) => line.split(' ')[2] === PROTECTED);

if (toMain && process.env.HEACH_ALLOW_MAIN_PUSH !== '1') {
  fail('Pushing to main is blocked. Push a branch and open a pull request so CI runs first.');
}
