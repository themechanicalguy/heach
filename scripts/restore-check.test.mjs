import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';

// Freshness and alerting of deploy/dev/restore-check.sh (spec 006), without Docker: the run
// starts in an empty folder, so any stage after freshness fails at `restore`.
const run = promisify(execFile);
const script = fileURLToPath(new URL('../deploy/dev/restore-check.sh', import.meta.url));
let work;

const stamp = (date) =>
  date
    .toISOString()
    .replace(/:\d\d\.\d+Z$/, 'Z')
    .replace(':', '');

before(async () => {
  work = await mkdtemp(join(tmpdir(), 'restore-check-test-'));
  await writeFile(
    join(work, 'alert.sh'),
    `#!/bin/bash\nprintf '%s\\n%s\\n---\\n' "$1" "$2" >> '${join(work, 'alerts.log')}'\n`,
  );
  await chmod(join(work, 'alert.sh'), 0o755);
});

after(() => rm(work, { recursive: true, force: true }));

async function check(names) {
  const dumps = await mkdtemp(join(work, 'dumps-'));
  await mkdir(join(dumps, 'pg'));
  for (const name of names) await writeFile(join(dumps, name), 'x');
  const env = {
    PATH: process.env.PATH,
    RESTORE_CHECK_DIR: await mkdtemp(join(work, 'host-')),
    RESTORE_CHECK_DUMPS: dumps,
    RESTORE_CHECK_JOB: 'true',
    RESTORE_CHECK_ALERT: join(work, 'alert.sh'),
  };
  const result = await run('bash', [script], { env }).then(
    ({ stdout }) => ({ code: 0, stdout }),
    (error) => ({ code: error.code, stdout: `${error.stdout}${error.stderr}` }),
  );
  const log = await readFile(join(work, 'alerts.log'), 'utf8').catch(() => '');
  await rm(join(work, 'alerts.log'), { force: true });
  return { ...result, alerts: log.split('\n---\n').filter(Boolean) };
}

const hoursAgo = (hours) => `pg/${stamp(new Date(Date.now() - hours * 3600_000))}.dump`;

test('EN-10.6: no dump fails at freshness with one alert', async () => {
  const { code, alerts } = await check([]);
  assert.equal(code, 1);
  assert.equal(alerts.length, 1);
  assert.match(alerts[0], /^\[HEACH\] Restore check failed: freshness\n/);
  assert.match(alerts[0], /run restorecheck-[0-9a-f-]{36}/);
});

test('EN-10.6: a newest dump 27 hours old fails at freshness and names the dump', async () => {
  const old = hoursAgo(27);
  const { code, alerts } = await check([hoursAgo(50), old]);
  assert.equal(code, 1);
  assert.match(alerts[0], /failed: freshness\n/);
  assert.ok(alerts[0].includes(old));
});

test('EN-10.6: a dump 25 hours old passes freshness (the next stage runs)', async () => {
  const { code, stdout, alerts } = await check([hoursAgo(25), hoursAgo(49)]);
  assert.equal(code, 1);
  assert.match(stdout, /stage=freshness ok/);
  assert.match(alerts[0], /failed: restore\n/);
});

test('EN-10.6: only dump objects count; the newest is chosen by name', async () => {
  const newest = hoursAgo(1);
  const { stdout } = await check([hoursAgo(5), newest, 'pg/notes.txt']);
  assert.ok(stdout.includes(`dump=${newest}`));
});
