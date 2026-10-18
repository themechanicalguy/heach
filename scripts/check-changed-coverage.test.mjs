import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  changedLines,
  isMeasured,
  measure,
  parseLcov,
  THRESHOLD,
} from './check-changed-coverage.mjs';

const diff = `diff --git a/apps/api/src/x.ts b/apps/api/src/x.ts
+++ b/apps/api/src/x.ts
@@ -0,0 +1,5 @@
diff --git a/apps/api/src/x.spec.ts b/apps/api/src/x.spec.ts
+++ b/apps/api/src/x.spec.ts
@@ -0,0 +1,3 @@
`;

test('measures source files only', () => {
  assert.equal(isMeasured('apps/api/src/x.ts'), true);
  assert.equal(isMeasured('apps/api/src/x.spec.ts'), false);
  assert.equal(isMeasured('apps/web/src/app/[locale]/page.tsx'), false);
  assert.equal(isMeasured('packages/types/src/generated/api.ts'), false);
  assert.deepEqual(Object.keys(changedLines(diff)), ['apps/api/src/x.ts']);
});

test('TS-01.1 fixture: 2 of 4 changed lines covered is below 80 percent and fails', () => {
  const lcov = 'SF:/repo/apps/api/src/x.ts\nDA:1,3\nDA:2,1\nDA:3,0\nDA:4,0\nend_of_record\n';
  const result = measure(
    changedLines(diff),
    parseLcov([{ text: lcov, dir: '/repo/apps/api' }], '/repo'),
  );
  assert.equal(result.total, 4);
  assert.equal(result.ratio < THRESHOLD, true);
  assert.deepEqual(result.uncovered, ['apps/api/src/x.ts:3', 'apps/api/src/x.ts:4']);
});

test('unions hits across unit and integration runs', () => {
  const unit = 'SF:src/x.ts\nDA:1,0\nDA:2,0\nend_of_record\n';
  const integration = 'SF:src/x.ts\nDA:1,1\nDA:2,4\nend_of_record\n';
  const hits = parseLcov(
    [
      { text: unit, dir: '/repo/apps/api' },
      { text: integration, dir: '/repo/apps/api' },
    ],
    '/repo',
  );
  assert.equal(measure(changedLines(diff), hits).ratio, 1);
});
