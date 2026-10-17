// pnpm dev:up — one command for local development:
//   1. create or complete .env
//   2. move any port another program already uses to the next free one (updates .env)
//   3. start PostgreSQL, Redis, S3 and Mailpit, wait until healthy, create the bucket
//   4. start the three apps (skipped with --services-only)
import { execFileSync, spawn } from 'node:child_process';
import process from 'node:process';
import { resolvePorts } from './lib/resolve-ports.mjs';

const ENV_FILE = '.env';
const servicesOnly = process.argv.includes('--services-only');
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });

run('node', ['scripts/setup.mjs']);

const { moves, env } = await resolvePorts(ENV_FILE);
for (const move of moves) process.stdout.write(`Port moved. ${move}\n`);

run('docker', ['compose', 'up', '-d', '--wait', 'postgres', 'redis', 's3', 'mailpit']);
run('docker', ['compose', 'run', '--rm', 's3-init']);
// Database roles, audit schema and migrations (EN-10), as a deploy does.
run('pnpm', ['--filter', '@heach/api...', 'build']);
run('pnpm', ['--filter', '@heach/api', 'db:bootstrap']);
run('pnpm', ['--filter', '@heach/api', 'db:migrate']);
printUrls(env);

if (!servicesOnly) {
  // The apps read their ports from the environment; .env holds the ones chosen above.
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- runs the developer's pnpm
  const child = spawn('pnpm', ['dev'], { stdio: 'inherit', env: { ...process.env, ...env } });
  child.on('exit', (code) => {
    process.exitCode = code ?? 0;
  });
}

function printUrls(values) {
  const rows = [
    ['Web', `http://localhost:${values.WEB_PORT}`],
    ['Admin', `http://localhost:${values.ADMIN_PORT}`],
    ['API', `http://localhost:${values.API_PORT} (/readyz, /docs)`],
    ['Inbox', `http://localhost:${values.MAILPIT_UI_PORT}`],
    ['PostgreSQL', `localhost:${values.POSTGRES_PORT}`],
    ['Redis', `localhost:${values.REDIS_PORT}`],
    ['S3', `http://localhost:${values.S3_PORT}`],
  ];
  const lines = rows.map(([name, url]) => '  ' + name.padEnd(11) + url);
  process.stdout.write(`\n${lines.join('\n')}\n\n`);
}
