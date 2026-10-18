import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';

const deploy = readFileSync(new URL('../deploy/dev/deploy.sh', import.meta.url), 'utf8');

test('EN-12.2: every deploy restarts the API after bootstrap sets the role passwords', () => {
  const bootstrap = deploy.indexOf('dist/db/bootstrap.js');
  const restart = deploy.indexOf('up -d --no-deps --force-recreate api');
  assert.ok(bootstrap > 0, 'deploy.sh runs db:bootstrap');
  assert.ok(restart > bootstrap, 'the API is recreated after bootstrap');
});
