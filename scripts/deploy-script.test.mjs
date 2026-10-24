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

const compose = readFileSync(new URL('../deploy/dev/compose.yml', import.meta.url), 'utf8');
const caddyfile = readFileSync(new URL('../deploy/dev/Caddyfile', import.meta.url), 'utf8');
const credentials = readFileSync(
  new URL('../deploy/dev/api-credentials.sh', import.meta.url),
  'utf8',
);

/** The text of one Compose service, up to the next top-level service key. */
function service(name) {
  const start = compose.indexOf(`\n  ${name}:\n`);
  const next = compose.slice(start + 1).search(/\n {2}[a-z]+:\n|\nvolumes:/);
  return compose.slice(start, start + 1 + next);
}

test('EN-12.4: the long-running API never receives the administrator or migrator password', () => {
  const envFile = deploy.slice(deploy.indexOf('umask 077'), deploy.indexOf('} > .env'));
  assert.doesNotMatch(envFile, /DB_ADMIN_PASSWORD|DB_MIGRATOR_PASSWORD|DB_APP_PASSWORD/);
  // Only the one-off bootstrap and migration containers get them, from the shell environment.
  const runs = deploy.match(
    /docker compose run --rm --no-deps -e SECRETS_SOURCE=env api node dist\/db\/\w+\.js/g,
  );
  assert.deepEqual(runs?.length, 2);
  assert.doesNotMatch(deploy, /export DB_(ADMIN|MIGRATOR)_PASSWORD/);
});

test('EN-12.4: the API container uses the API role, not the instance role', () => {
  const api = service('api');
  assert.match(api, /AWS_CONFIG_FILE: \/aws\/config/);
  assert.match(api, /- \.\/aws:\/aws:ro/);
  assert.match(credentials, /role\/heach-dev-api"/);
  assert.match(credentials, /--duration-seconds 3600/);
  assert.match(credentials, /credential_process = cat \/aws\/credentials\.json/);
  assert.match(credentials, /chmod 640 "\$tmp"/);
});

test('EN-12.4: a deploy stops before changing anything when the API role is missing', () => {
  const preflight = deploy.indexOf('bash api-credentials.sh');
  assert.ok(preflight > 0, 'deploy.sh mints API credentials in its preflight');
  assert.ok(preflight < deploy.indexOf('} > .env'), 'before .env is rewritten');
  assert.ok(preflight < deploy.indexOf('docker compose pull'), 'before images change');
  assert.match(deploy, /heach-api-credentials\.timer/);
});

test('SE-07.23: the public entry refuses test sign-in and drops a client-sent key', () => {
  const site = caddyfile.slice(caddyfile.indexOf('https://{$PUBLIC_HOST}:443'));
  const publicSite = site.slice(0, site.indexOf('\n}\n'));
  assert.match(publicSite, /@test_login path_regexp test_login \(\?i\)\/auth\/\+test-login/);
  assert.match(publicSite, /respond @test_login 404/);
  assert.match(publicSite, /request_header -X-Test-Login-Key/);
  assert.ok(publicSite.indexOf('respond @test_login') < publicSite.indexOf('reverse_proxy api'));
  assert.doesNotMatch(publicSite, /header_up X-Test-Login-Key/);
});

test('SE-07.23: only the loopback entry adds the key, and it is published on loopback only', () => {
  const trusted = caddyfile.slice(caddyfile.indexOf('https://{$PUBLIC_HOST}:9443'));
  assert.match(trusted, /header_up X-Test-Login-Key \{env\.TEST_LOGIN_KEY\}/);
  assert.match(service('caddy'), /- 127\.0\.0\.1:9443:9443/);
  const published = compose.split('\n').filter((line) => line.includes(':9443:9443'));
  assert.deepEqual(
    published.map((line) => line.trim().split(' ')[1]),
    ['127.0.0.1:9443:9443'],
  );
});

test('EN-10.5: every deploy installs and enables the weekly restore check timer', () => {
  const timers = deploy.slice(
    deploy.indexOf('install -m 644'),
    deploy.indexOf('systemctl daemon-reload'),
  );
  assert.match(timers, /heach-restore-check\.service heach-restore-check\.timer/);
  const enable = deploy.slice(deploy.indexOf('systemctl enable --now'));
  assert.match(enable.slice(0, enable.indexOf('>/dev/null')), /heach-restore-check\.timer/);
  const timer = readFileSync(
    new URL('../deploy/dev/heach-restore-check.timer', import.meta.url),
    'utf8',
  );
  assert.match(timer, /OnCalendar=Sun \*-\*-\* 00:00:00 UTC/);
  assert.match(timer, /Persistent=true/);
});
