import assert from 'node:assert/strict';
import { test } from 'node:test';
import { specProblems } from './check-specs.mjs';

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
