import type { EncryptedField } from '@heach/crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { type TransactionClient, withTransaction } from '../data-stores/transaction.js';

export type OtpPurpose = 'sign_in' | 'reverify' | 'change_mobile';

export interface OtpChallengeRow {
  id: string;
  purpose: OtpPurpose;
  mobile: EncryptedField;
  mobile_index: string;
  account_id: string | null;
  code_hash: string;
  attempts: number;
  resends: number;
  expires_at: Date;
  resend_at: Date;
  consumed_at: Date | null;
}

export interface NewChallenge {
  id: string;
  purpose: OtpPurpose;
  mobile: EncryptedField;
  mobileIndex: string;
  accountId: string | null;
  codeHash: string;
  expiresAt: Date;
  resendAt: Date;
}

const PURGE_AFTER = '24 hours';

/** OTP challenges (decision L-6). A challenge is locked while it is checked or resent. */
@Injectable()
export class OtpRepository {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  transaction<T>(work: (client: TransactionClient) => Promise<T>): Promise<T> {
    return withTransaction(this.pool, work);
  }

  async create(challenge: NewChallenge): Promise<void> {
    await this.pool.query(
      `INSERT INTO app.otp_challenge
         (id, purpose, mobile, mobile_index, account_id, code_hash, expires_at, resend_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        challenge.id,
        challenge.purpose,
        challenge.mobile,
        challenge.mobileIndex,
        challenge.accountId,
        challenge.codeHash,
        challenge.expiresAt,
        challenge.resendAt,
      ],
    );
  }

  async lock(client: TransactionClient, id: string): Promise<OtpChallengeRow | undefined> {
    const { rows } = await client.query<OtpChallengeRow>(
      `SELECT id, purpose, mobile, mobile_index, account_id, code_hash, attempts, resends,
              expires_at, resend_at, consumed_at
         FROM app.otp_challenge WHERE id = $1 FOR UPDATE`,
      [id],
    );
    return rows[0];
  }

  async recordWrongCode(client: TransactionClient, id: string): Promise<void> {
    await client.query('UPDATE app.otp_challenge SET attempts = attempts + 1 WHERE id = $1', [id]);
  }

  async consume(client: TransactionClient, id: string): Promise<void> {
    await client.query('UPDATE app.otp_challenge SET consumed_at = now() WHERE id = $1', [id]);
  }

  /** A new code for the same challenge: fresh expiry and attempts, one more resend. */
  async replaceCode(
    client: TransactionClient,
    id: string,
    change: { codeHash: string; expiresAt: Date; resendAt: Date },
  ): Promise<void> {
    await client.query(
      `UPDATE app.otp_challenge
          SET code_hash = $2, expires_at = $3, resend_at = $4, attempts = 0, resends = resends + 1
        WHERE id = $1`,
      [id, change.codeHash, change.expiresAt, change.resendAt],
    );
  }

  /** Retention (decision L-6): challenges go 24 hours after expiry, a bounded batch at a time. */
  async purgeExpired(): Promise<void> {
    await this.pool.query(
      `DELETE FROM app.otp_challenge WHERE id IN (
         SELECT id FROM app.otp_challenge WHERE expires_at < now() - $1::interval LIMIT 500)`,
      [PURGE_AFTER],
    );
  }
}
