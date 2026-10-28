import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { createLogger } from '@heach/logger';
import pg from 'pg';
import { MIN_PASSWORD_LENGTH, hashPassword } from '../admin/password.js';
import { ADMIN_ROLES, type AdminRole } from '../common/request-context.js';
import { pgClientConfig, requireEnv } from '../db/connection.js';
import { loadSecrets } from '../secrets/load-secrets.js';

const logger = createLogger({ name: 'jobs' });

export interface NewAdmin {
  email: string;
  role: AdminRole;
  password: string;
}

/** Validates the operator's input; returns the reason it is refused, or undefined. */
export function problemWith(admin: {
  email?: string;
  role?: string;
  password: string;
}): string | undefined {
  const [local, domain, ...extra] = (admin.email ?? '').split('@');
  if (!local || !domain?.includes('.') || extra.length > 0 || /\s/.test(admin.email ?? '')) {
    return 'a valid --email';
  }
  if (!admin.role || !(ADMIN_ROLES as readonly string[]).includes(admin.role)) {
    return `--role, one of ${ADMIN_ROLES.join(', ')}`;
  }
  if (admin.password.length < MIN_PASSWORD_LENGTH) {
    return `a password of at least ${String(MIN_PASSWORD_LENGTH)} characters on standard input`;
  }
  return undefined;
}

/**
 * Creates an admin account (decision L-9). The password comes from standard input, so it is never
 * in the shell history or the process list; the admin enrols TOTP at first sign-in.
 */
export async function createAdmin(
  client: Pick<pg.Client, 'query'>,
  admin: NewAdmin,
): Promise<void> {
  await client.query(
    `INSERT INTO app.admin_account (id, email, password_hash, role)
     VALUES (gen_random_uuid(), $1, $2, $3)`,
    [admin.email.trim().toLowerCase(), await hashPassword(admin.password), admin.role],
  );
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks)
    .toString('utf8')
    .replace(/\r?\n$/, '');
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, role: { type: 'string' } },
  });
  const password = await readStdin();
  const problem = problemWith({ ...values, password });
  if (problem) {
    logger.error({ event: 'admin_create_refused' }, `Give ${problem}`);
    process.exit(2);
  }
  await loadSecrets(process.env, ['DB_APP_PASSWORD']);
  const client = new pg.Client(
    pgClientConfig(
      requireEnv(process.env, 'DATABASE_URL'),
      process.env.DATABASE_PASSWORD,
      requireEnv(process.env, 'DATA_TLS_CA_FILE'),
    ),
  );
  await client.connect();
  await createAdmin(client, {
    email: values.email ?? '',
    role: values.role as AdminRole,
    password,
  });
  await client.end();
  logger.info({ event: 'admin_created', role: values.role }, 'Admin account created');
}
