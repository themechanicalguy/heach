// Prints the current sign-in code for one demo admin, read from .demo-credentials.json, so the
// local demo needs no authenticator app. Local and test only.
// Usage: pnpm demo:totp <super|verifier|support|finance>
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { URL } from 'node:url';
import { totp } from './client.mjs';
import { refuseOutsideLocal } from './db.mjs';

refuseOutsideLocal();
const wanted = process.argv[2] ?? 'super';
const { admins } = JSON.parse(
  readFileSync(new URL('../../../.demo-credentials.json', import.meta.url), 'utf8'),
);
const admin = admins.find((a) => a.email.startsWith(`${wanted}@`));
if (!admin) {
  process.stderr.write('Usage: pnpm demo:totp <super|verifier|support|finance>\n');
  process.exit(1);
}
const left = 30 - (Math.floor(Date.now() / 1000) % 30);
process.stdout.write(`${admin.email}: ${totp(admin.totpSecret)} (valid ${String(left)} s more)\n`);
