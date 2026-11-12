import { randomUUID } from 'node:crypto';
import type { Locale } from '@heach/i18n';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { type TransactionClient, withTransaction } from '../data-stores/transaction.js';
import { SESSION_MINUTES } from './assisted-rules.js';

export type EndReason = 'submitted' | 'ended' | 'refused';

export interface AssistedSessionRow {
  id: string;
  adminId: string;
  /** Null until the provider has consented. */
  accountId: string | null;
  consentChallengeId: string;
  locale: Locale;
  expiresAt: Date;
  accountCreated: boolean;
  payoutChallengeId: string | null;
  endedAt: Date | null;
  /** The clock decided, in the database, that the session has run out. */
  expired: boolean;
  accountSuspended: boolean;
}

const COLUMNS = `s.id, s.admin_id AS "adminId", s.account_id AS "accountId",
  s.consent_challenge_id AS "consentChallengeId", s.locale, s.expires_at AS "expiresAt",
  s.account_created AS "accountCreated", s.payout_challenge_id AS "payoutChallengeId",
  s.ended_at AS "endedAt", s.expires_at <= now() AS expired,
  coalesce(a.status = 'suspended', false) AS "accountSuspended"`;

const FROM = 'FROM app.assisted_session s LEFT JOIN app.account a ON a.id = s.account_id';

/** Assisted-onboarding sessions (AD-12). Rows are evidence: the API role cannot delete them. */
@Injectable()
export class AssistedSessionRepository {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  transaction<T>(work: (client: TransactionClient) => Promise<T>): Promise<T> {
    return withTransaction(this.pool, work);
  }

  /** Starts a request for the provider's consent; any earlier unanswered request of this admin ends. */
  async createPending(input: {
    adminId: string;
    consentChallengeId: string;
    locale: Locale;
  }): Promise<string> {
    const id = randomUUID();
    await this.transaction(async (client) => {
      await client.query(
        `UPDATE app.assisted_session SET ended_at = now(), end_reason = 'ended'
          WHERE admin_id = $1 AND consented_at IS NULL AND ended_at IS NULL`,
        [input.adminId],
      );
      await client.query(
        `INSERT INTO app.assisted_session (id, admin_id, consent_challenge_id, locale, expires_at)
         VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5))`,
        [id, input.adminId, input.consentChallengeId, input.locale, SESSION_MINUTES],
      );
    });
    return id;
  }

  /** The admin's own session, whatever its state; undefined for another admin's. */
  async find(id: string, adminId: string): Promise<AssistedSessionRow | undefined> {
    const { rows } = await this.pool.query<AssistedSessionRow>(
      `SELECT ${COLUMNS} ${FROM} WHERE s.id = $1 AND s.admin_id = $2`,
      [id, adminId],
    );
    return rows[0];
  }

  /** A request still waiting for the provider's code. */
  async pending(id: string, adminId: string): Promise<AssistedSessionRow | undefined> {
    const { rows } = await this.pool.query<AssistedSessionRow>(
      `SELECT ${COLUMNS} ${FROM}
        WHERE s.id = $1 AND s.admin_id = $2 AND s.consented_at IS NULL
          AND s.ended_at IS NULL AND s.expires_at > now()`,
      [id, adminId],
    );
    return rows[0];
  }

  /** The admin's consented session that is still running. */
  async openFor(adminId: string): Promise<AssistedSessionRow | undefined> {
    const { rows } = await this.pool.query<AssistedSessionRow>(
      `SELECT ${COLUMNS} ${FROM}
        WHERE s.admin_id = $1 AND s.consented_at IS NOT NULL
          AND s.ended_at IS NULL AND s.expires_at > now()
        ORDER BY s.consented_at DESC LIMIT 1`,
      [adminId],
    );
    return rows[0];
  }

  /**
   * Opens the session on the provider's account. False when another admin's session on the same
   * account is running; the caller holds the account row lock.
   */
  async open(
    client: TransactionClient,
    input: { id: string; accountId: string; accountCreated: boolean },
  ): Promise<boolean> {
    const { rowCount: others } = await client.query(
      `SELECT 1 FROM app.assisted_session
        WHERE account_id = $1 AND id <> $2 AND ended_at IS NULL AND expires_at > now()`,
      [input.accountId, input.id],
    );
    if (others) return false;
    const { rowCount } = await client.query(
      `UPDATE app.assisted_session
          SET account_id = $2, account_created = $3, consented_at = now(),
              expires_at = now() + make_interval(mins => $4)
        WHERE id = $1 AND consented_at IS NULL AND ended_at IS NULL AND expires_at > now()`,
      [input.id, input.accountId, input.accountCreated, SESSION_MINUTES],
    );
    return rowCount === 1;
  }

  /** Binds a payout code (PO-06) to the session; a code sent earlier no longer counts. */
  async setPayoutChallenge(id: string, challengeId: string): Promise<void> {
    await this.pool.query(
      `UPDATE app.assisted_session SET payout_challenge_id = $2 WHERE id = $1 AND ended_at IS NULL`,
      [id, challengeId],
    );
  }

  /** Spends the payout code: true for the one caller that held it, so one code saves once. */
  async claimPayoutCode(id: string, challengeId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE app.assisted_session SET payout_challenge_id = NULL, payout_saved_at = now()
        WHERE id = $1 AND payout_challenge_id = $2 AND ended_at IS NULL`,
      [id, challengeId],
    );
    return rowCount === 1;
  }

  /** Ends a session once; false when it had already ended. */
  async end(id: string, reason: EndReason): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE app.assisted_session SET ended_at = now(), end_reason = $2
        WHERE id = $1 AND ended_at IS NULL`,
      [id, reason],
    );
    return rowCount === 1;
  }
}
