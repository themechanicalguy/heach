import 'reflect-metadata';
import { createLogger } from '@heach/logger';
import pg from 'pg';
import { pgClientConfig, requireEnv } from '../db/connection.js';
import { loadSecrets } from '../secrets/load-secrets.js';

const logger = createLogger({ name: 'jobs' });

/**
 * Retention windows for internal security records (default D-5). They are the proposals in
 * docs/login-and-account-setup.md and await the lawyer (PR-05); change them here and there.
 */
export const RETENTION = {
  otpChallenge: '24 hours',
  session: '30 days',
  closedMembership: '30 days',
} as const;

export interface PurgeCounts {
  otpChallenges: number;
  sessions: number;
  adminSessions: number;
  invitationsExpired: number;
  memberships: number;
}

type Client = Pick<pg.Client, 'query'>;

async function count(client: Client, sql: string, window?: string): Promise<number> {
  const result = await client.query(sql, window ? [window] : []);
  return result.rowCount ?? 0;
}

/** Sessions that can no longer refresh: revoked or expired longer ago than the window. */
const purgeSessions = (table: 'app.session' | 'app.admin_session') =>
  `DELETE FROM ${table}
    WHERE revoked_at < now() - $1::interval OR expires_at < now() - $1::interval`;

/**
 * Deletes expired OTP challenges and dead sessions, closes invitations past their expiry, and
 * deletes closed memberships after the window. Each statement is idempotent, so a rerun after a
 * partial failure is safe. Counts only are logged, never identifiers.
 */
export async function purgeExpired(client: Client): Promise<PurgeCounts> {
  return {
    otpChallenges: await count(
      client,
      'DELETE FROM app.otp_challenge WHERE expires_at < now() - $1::interval',
      RETENTION.otpChallenge,
    ),
    sessions: await count(client, purgeSessions('app.session'), RETENTION.session),
    adminSessions: await count(client, purgeSessions('app.admin_session'), RETENTION.session),
    invitationsExpired: await count(
      client,
      `UPDATE app.membership SET status = 'expired', ended_at = now()
        WHERE status = 'invited' AND expires_at <= now()`,
    ),
    memberships: await count(
      client,
      `DELETE FROM app.membership
        WHERE status IN ('declined', 'revoked', 'removed', 'expired')
          AND ended_at < now() - $1::interval`,
      RETENTION.closedMembership,
    ),
  };
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  await loadSecrets(process.env, ['DB_APP_PASSWORD']);
  const client = new pg.Client(
    pgClientConfig(
      requireEnv(process.env, 'DATABASE_URL'),
      process.env.DATABASE_PASSWORD,
      requireEnv(process.env, 'DATA_TLS_CA_FILE'),
    ),
  );
  await client.connect();
  try {
    const counts = await purgeExpired(client);
    logger.info({ event: 'purge_expired', ...counts }, 'Expired security records purged');
  } finally {
    await client.end();
  }
}
