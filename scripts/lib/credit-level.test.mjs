import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyLevel, isHigher, projectRunOut, warnings } from './credit-level.mjs';

test('either trigger reaches a level', () => {
  assert.equal(classifyLevel({ percentLeft: 90, daysLeft: 120 }), 'ok');
  assert.equal(classifyLevel({ percentLeft: 50, daysLeft: 120 }), 'Watch');
  assert.equal(classifyLevel({ percentLeft: 90, daysLeft: 60 }), 'Watch');
  assert.equal(classifyLevel({ percentLeft: 24, daysLeft: 120 }), 'Plan');
  assert.equal(classifyLevel({ percentLeft: 90, daysLeft: 15 }), 'Act');
  assert.equal(classifyLevel({ percentLeft: 5, daysLeft: 120 }), 'Emergency');
  assert.equal(classifyLevel({ percentLeft: 90, daysLeft: 2 }), 'Emergency');
});

test('only a rise in level counts', () => {
  assert.equal(isHigher('Plan', 'Watch'), true);
  assert.equal(isHigher('Watch', 'Plan'), false);
  assert.equal(isHigher('Watch', undefined), true);
  assert.equal(isHigher('ok', undefined), false);
});

test('burn rate warns when credits run out before the plan ends', () => {
  const today = new Date('2026-10-17T00:00:00Z');
  const expiry = new Date('2027-04-17T00:00:00Z');
  const runOut = projectRunOut({ remaining: 60, dailySpend: 1, today });
  assert.equal(runOut.toISOString().slice(0, 10), '2026-12-16');
  assert.match(warnings({ status: 'ACTIVE', runOut, expiry })[0], /^Burn rate/);
  assert.equal(projectRunOut({ remaining: 60, dailySpend: 0, today }), null);
});

test('a plan status other than ACTIVE warns', () => {
  assert.match(warnings({ status: 'EXPIRED', runOut: null, expiry: new Date() })[0], /EXPIRED/);
});
