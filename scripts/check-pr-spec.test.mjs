import assert from 'node:assert/strict';
import { test } from 'node:test';
import { linkedSpecs, prSpecProblems } from './check-pr-spec.mjs';

const approvedSpec =
  '**Status**: Approved\n\n| ID | Given | Proof |\n| --- | --- | --- |\n| AC-01.1 | x | Unit |\n';
const files = {
  'specs/001-otp-login/spec.md': approvedSpec,
  'specs/001-otp-login/plan.md': '**Status**: Approved\n',
  'docs/specs/step-02-secure-foundation.md':
    '- **Status:** Approved (on merge)\n| EN-03.1 | x | y |\n',
};
const read = (file) => files[file];
const pr = (overrides) => ({
  changed: ['apps/api/src/auth/otp.ts'],
  body: 'Spec: specs/001-otp-login/\nSatisfies AC-01.1',
  labels: [],
  readAtBase: read,
  readAtHead: read,
  ...overrides,
});

test('linkedSpecs finds step specs and feature directories', () => {
  assert.deepEqual(
    linkedSpecs('see docs/specs/step-02-secure-foundation.md and specs/001-otp-login/'),
    [
      ['docs/specs/step-02-secure-foundation.md'],
      ['specs/001-otp-login/spec.md', 'specs/001-otp-login/plan.md'],
    ],
  );
});

test('a code pull request linking an approved feature spec and its criterion passes', () => {
  assert.deepEqual(prSpecProblems(pr({})), []);
});

test('a step spec link with its criterion passes', () => {
  const body = 'docs/specs/step-02-secure-foundation.md EN-03.1';
  assert.deepEqual(prSpecProblems(pr({ body })), []);
});

test('changes outside apps, packages and infra need no spec', () => {
  assert.deepEqual(prSpecProblems(pr({ changed: ['docs/README.md'], body: '' })), []);
});

test('fixture: a code pull request without a spec link fails', () => {
  assert.match(prSpecProblems(pr({ body: 'Fixes AC-01.1' }))[0], /Link the approved spec/);
});

test('fixture: a spec that is still Draft on the base branch fails', () => {
  const draft = {
    ...files,
    'specs/001-otp-login/spec.md': '**Status**: Draft\n| AC-01.1 | x | y |',
  };
  const problems = prSpecProblems(pr({ readAtBase: (file) => draft[file] }));
  assert.deepEqual(problems, [
    'specs/001-otp-login/spec.md is Draft on the base branch, not Approved',
  ]);
});

test('fixture: a spec not yet merged fails', () => {
  const problems = prSpecProblems(pr({ readAtBase: () => undefined }));
  assert.match(problems[0], /not on the base branch; merge the spec first/);
});

test('fixture: no criterion ID, or one the spec does not define, fails', () => {
  assert.match(prSpecProblems(pr({ body: 'specs/001-otp-login/' }))[0], /Name the criterion IDs/);
  assert.deepEqual(prSpecProblems(pr({ body: 'specs/001-otp-login/ AC-01.9' })), [
    'AC-01.9 is not a criterion in the linked specs',
  ]);
});

test('IDs inside HTML comments (template hints) do not count', () => {
  const body = '<!-- for example EN-03.1 -->\nspecs/001-otp-login/';
  assert.match(prSpecProblems(pr({ body }))[0], /Name the criterion IDs/);
});

test('spec-exempt needs a written reason', () => {
  assert.match(prSpecProblems(pr({ labels: ['spec-exempt'], body: '' }))[0], /Spec exemption/);
  const body = 'Spec exemption: dependency bump, no behaviour change';
  assert.deepEqual(prSpecProblems(pr({ labels: ['spec-exempt'], body })), []);
});
