import assert from 'node:assert/strict';
import { test } from 'node:test';
import { worktreeMounts } from './secrets.mjs';

test('a normal checkout needs no extra mount', () => {
  assert.deepEqual(worktreeMounts('/work/heach', '/work/heach/.git\n'), []);
});

test('a worktree mounts the common git directory read-only at its own path', () => {
  assert.deepEqual(worktreeMounts('/work/heach-feature', '/work/heach/.git\n'), [
    '-v',
    '/work/heach/.git:/work/heach/.git:ro',
  ]);
});

test('no git answer adds nothing', () => {
  assert.deepEqual(worktreeMounts('/work/heach', null), []);
});
