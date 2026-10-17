// Values that .env.example cannot hold as placeholders: random local-only keys and the
// absolute path of the local TLS CA. Used by pnpm setup.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

export function makeLocalCerts(dir = '.certs') {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- local dev tool: runs the developer's bash and openssl
  execFileSync('bash', ['deploy/dev/make-certs.sh', dir], { stdio: 'inherit' });
  return resolve(dir, 'ca.crt');
}

/** Replaces `<generate:…>` placeholders; other values pass through unchanged. */
export function generatedValue(value, caFile) {
  if (value === '<generate:hex32>') return randomBytes(32).toString('hex');
  if (value === '<generate:ca-file>') return caFile;
  return value;
}
