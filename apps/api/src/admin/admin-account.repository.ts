import { randomUUID } from 'node:crypto';
import type { EncryptedField } from '@heach/crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import type { AdminRole } from '../common/request-context.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';

export interface AdminAccount {
  id: string;
  email: string;
  passwordHash: string;
  role: AdminRole;
  active: boolean;
  totpSecret: EncryptedField | null;
  totpEnrolled: boolean;
  totpLastStep: number | null;
  lockedUntil: Date | null;
}

interface AdminRow {
  id: string;
  email: string;
  password_hash: string;
  role: AdminRole;
  status: 'active' | 'disabled';
  totp_secret: EncryptedField | null;
  totp_enrolled_at: Date | null;
  totp_last_step: string | null;
  locked_until: Date | null;
}

/** Five wrong passwords lock the account for 15 minutes (decision L-9). */
export const LOCKOUT = { attempts: 5, minutes: 15 } as const;

const COLUMNS =
  'id, email, password_hash, role, status, totp_secret, totp_enrolled_at, totp_last_step, locked_until';

/** Admin accounts (AD-01). The TOTP secret is stored only field-encrypted (Restricted). */
@Injectable()
export class AdminAccountRepository {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async create(admin: { email: string; passwordHash: string; role: AdminRole }): Promise<string> {
    const id = randomUUID();
    await this.pool.query(
      'INSERT INTO app.admin_account (id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      [id, admin.email, admin.passwordHash, admin.role],
    );
    return id;
  }

  async findByEmail(email: string): Promise<AdminAccount | undefined> {
    const { rows } = await this.pool.query<AdminRow>(
      `SELECT ${COLUMNS} FROM app.admin_account WHERE email = $1`,
      [email],
    );
    return rows[0] && toAdmin(rows[0]);
  }

  async findById(id: string): Promise<AdminAccount | undefined> {
    const { rows } = await this.pool.query<AdminRow>(
      `SELECT ${COLUMNS} FROM app.admin_account WHERE id = $1`,
      [id],
    );
    return rows[0] && toAdmin(rows[0]);
  }

  /** Counts a wrong password; the fifth starts a lockout and restarts the count. */
  async recordFailure(id: string): Promise<boolean> {
    const { rows } = await this.pool.query<{ locked: boolean }>(
      `UPDATE app.admin_account
          SET failed_attempts = CASE WHEN failed_attempts + 1 >= $2 THEN 0 ELSE failed_attempts + 1 END,
              locked_until = CASE WHEN failed_attempts + 1 >= $2
                                  THEN now() + make_interval(mins => $3) ELSE locked_until END
        WHERE id = $1
        RETURNING locked_until > now() AS locked`,
      [id, LOCKOUT.attempts, LOCKOUT.minutes],
    );
    return rows[0]?.locked === true;
  }

  async resetFailures(id: string): Promise<void> {
    await this.pool.query('UPDATE app.admin_account SET failed_attempts = 0 WHERE id = $1', [id]);
  }

  /** A secret for enrolment; replaced at each sign-in until a code from it has been accepted. */
  async setPendingSecret(id: string, secret: EncryptedField): Promise<void> {
    await this.pool.query(
      'UPDATE app.admin_account SET totp_secret = $2 WHERE id = $1 AND totp_enrolled_at IS NULL',
      [id, secret],
    );
  }

  /**
   * Records an accepted TOTP step; false if a step at least as late was already used, which makes
   * two concurrent requests with one code succeed once only.
   */
  async acceptStep(id: string, step: number, signIn: boolean): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE app.admin_account
          SET totp_last_step = $2,
              totp_enrolled_at = coalesce(totp_enrolled_at, now()),
              last_sign_in_at = CASE WHEN $3 THEN now() ELSE last_sign_in_at END
        WHERE id = $1 AND (totp_last_step IS NULL OR totp_last_step < $2)`,
      [id, step, signIn],
    );
    return result.rowCount === 1;
  }
}

function toAdmin(row: AdminRow): AdminAccount {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    active: row.status === 'active',
    totpSecret: row.totp_secret,
    totpEnrolled: row.totp_enrolled_at !== null,
    totpLastStep: row.totp_last_step === null ? null : Number(row.totp_last_step),
    lockedUntil: row.locked_until,
  };
}
