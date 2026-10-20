import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { duplicateProblems, featureProblems, indexProblems, specProblems } from './check-specs.mjs';

test('SO-01.1 fixture: a spec without a threat model fails', () => {
  assert.deepEqual(specProblems('step-09.md', '# Step 9\n## Data\n'), [
    'step-09.md: no "## Threat model" section (SO-01.1)',
  ]);
});

test('SO-01.1 fixture: an empty threat model table fails', () => {
  const md =
    '## Threat model (SO-01)\n\n| Threat | Mitigation | Criterion |\n| --- | --- | --- |\n\n## Screens\n';
  assert.deepEqual(specProblems('step-09.md', md), [
    'step-09.md: threat model has no threats (SO-01.1)',
  ]);
});

test('a filled threat model passes', () => {
  const md =
    '## Threat model\n| Threat | Mitigation | Criterion |\n| --- | --- | --- |\n| Spoofing | Tokens | SE-07.1 |\n';
  assert.deepEqual(specProblems('step-02.md', md), []);
});

const SPEC_TEMPLATE = readFileSync('.specify/templates/overrides/spec-template.md', 'utf8');
const PLAN_TEMPLATE = readFileSync('.specify/templates/overrides/plan-template.md', 'utf8');
const KNOWN = new Set(['AC-01', 'EN-03']);

/** The spec template filled in just enough to pass, with the given Status. */
function filledSpec(specStatus) {
  return SPEC_TEMPLATE.replace('**Status**: Draft', `**Status**: ${specStatus}`)
    .replace('step-NN-short-name.md', 'step-03-accounts.md')
    .replace('**Approval**: [Owner', '**Approval**: Owner, 2026-10-21, #60 [')
    .replace('| [REQ-ID].1 | Given [state]', '| AC-01.1 | Given a state')
    .replace('| [Question] | [REQ-ID].n | [Owner] |', '');
}
const filledPlan = PLAN_TEMPLATE.replace(
  '| | | |\n\n## Rollout',
  '| Spoofing | OTP | AC-01.1 |\n\n## Rollout',
);

test('ADR 0011: the HEACH templates carry every section the check requires', () => {
  const problems = featureProblems('specs/001-x', SPEC_TEMPLATE, PLAN_TEMPLATE, KNOWN);
  assert.equal(problems.filter((p) => p.includes('section')).length, 0, problems.join('\n'));
});

test('ADR 0011: a filled Approved feature spec and plan pass', () => {
  assert.deepEqual(featureProblems('specs/001-x', filledSpec('Approved'), filledPlan, KNOWN), []);
});

test('ADR 0011 fixture: a spec missing a required section fails', () => {
  const spec = filledSpec('Draft').replace('### Permissions', '### Roles');
  assert.deepEqual(featureProblems('specs/001-x', spec, undefined, KNOWN), [
    'specs/001-x/spec.md: no "### Permissions" section',
  ]);
});

test('ADR 0011 fixture: a criterion on an unknown requirement ID fails', () => {
  const spec = filledSpec('Draft').replace('| AC-01.1 |', '| ZZ-01.1 |');
  assert.match(
    featureProblems('specs/001-x', spec, undefined, KNOWN).join(),
    /ZZ-01\.1 does not build/,
  );
});

test('ADR 0011 fixture: an Approved spec with open questions, clarifications or no plan fails', () => {
  const spec = `${filledSpec('Approved')}\n| Which OTP length? | AC-01.1 | Owner |\n[NEEDS CLARIFICATION: x]`;
  assert.deepEqual(featureProblems('specs/001-x', spec, undefined, KNOWN), [
    'specs/001-x: Approved without plan.md',
    'specs/001-x: Approved with an open [NEEDS CLARIFICATION]',
    'specs/001-x: Approved with open questions',
  ]);
});

test('ADR 0011 fixture: a plan with an empty threat model fails (SO-01.1)', () => {
  assert.deepEqual(featureProblems('specs/001-x', filledSpec('Draft'), PLAN_TEMPLATE, KNOWN), [
    'specs/001-x/plan.md: threat model has no threats (SO-01.1)',
  ]);
});

test('ADR 0011 fixture: a criterion ID defined twice fails', () => {
  assert.deepEqual(duplicateProblems({ 'step-02.md': ['EN-03.1'], 'specs/001-x': ['EN-03.1'] }), [
    'EN-03.1 is defined more than once: step-02.md, specs/001-x',
  ]);
});

test('ADR 0011 fixture: a spec missing from the index fails', () => {
  const readme = '| [Step 2](step-02-a.md) |';
  const commented = `${readme}\n<!-- | [X](../../specs/001-x/spec.md) | -->`;
  assert.equal(indexProblems(commented, ['step-02-a.md'], ['001-x']).length, 1);
  assert.deepEqual(indexProblems(readme, ['step-02-a.md'], ['001-x']), [
    'docs/specs/README.md does not list 001-x',
  ]);
});
