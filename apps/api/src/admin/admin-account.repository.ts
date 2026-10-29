import { randomUUID } from 'node:crypto';
import type { EncryptedField } from '@heach/crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import type { AdminRole } from '../common/request-context.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { TEMPORARY_PASSWORD_HOURS } from './password.js';

type Queryable = Pick<pg.Pool, 'query'>;

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
  /** A temporary password from a reset: it must be replaced at this sign-in (O-2). */
  mustChangePassword: boolean;
  passwordExpiresAt: Date | null;
}

/** What a super admin sees of another admin; never a hash or a secret. */
export interface AdminSummary {
  id: string;
  email: string;
  role: AdminRole;
  status: 'active' | 'disabled';
  mfaEnrolled: boolean;
  mustChangePassword: boolean;
  locked: boolean;
  createdAt: Date;
  lastSignInAt: Date | null;
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
  must_change_password: boolean;
  password_expires_at: Date | null;
}

/** Five wrong passwords lock the account for 15 minutes (decision L-9). */
export const LOCKOUT = { attempts: 5, minutes: 15 } as const;

const COLUMNS = `id, email, password_hash, role, status, totp_secret, totp_enrolled_at, totp_last_step,
  locked_until, must_change_password, password_expires_at`;

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

  /** A new admin with a temporary password (O-2); undefined if the email is taken. */
  async createWithTemporaryPassword(
    client: TransactionClient,
    admin: { email: string; passwordHash: string; role: AdminRole },
  ): Promise<string | undefined> {
    const id = randomUUID();
    const result = await client.query(
      `INSERT INTO app.admin_account
         (id, email, password_hash, role, must_change_password, password_expires_at)
       VALUES ($1, $2, $3, $4, true, now() + make_interval(hours => $5))
       ON CONFLICT (email) DO NOTHING`,
      [id, admin.email, admin.passwordHash, admin.role, TEMPORARY_PASSWORD_HOURS],
    );
    return result.rowCount === 1 ? id : undefined;
  }

  async list(): Promise<AdminSummary[]> {
    const { rows } = await this.pool.query<AdminSummary>(
      `SELECT id, email, role, status, totp_enrolled_at IS NOT NULL AS "mfaEnrolled",
              must_change_password AS "mustChangePassword",
              coalesce(locked_until > now(), false) AS locked, created_at AS "createdAt",
              last_sign_in_at AS "lastSignInAt"
         FROM app.admin_account ORDER BY created_at`,
    );
    return rows;
  }

  /**
   * Locks every active super admin and the target until commit, so two concurrent changes
   * cannot both remove the last super admin. Returns the active super admins' IDs.
   */
  async lockForChange(client: TransactionClient, targetId: string): Promise<string[]> {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM app.admin_account WHERE role = 'super_admin' AND status = 'active'
        ORDER BY id FOR UPDATE`,
    );
    await client.query('SELECT 1 FROM app.admin_account WHERE id = $1 FOR UPDATE', [targetId]);
    return rows.map((row) => row.id);
  }

  async setRole(client: TransactionClient, id: string, role: AdminRole): Promise<boolean> {
    const result = await client.query(
      'UPDATE app.admin_account SET role = $2 WHERE id = $1 AND role <> $2',
      [id, role],
    );
    return result.rowCount === 1;
  }

  async setStatus(
    client: TransactionClient,
    id: string,
    status: 'active' | 'disabled',
  ): Promise<boolean> {
    const result = await client.query(
      'UPDATE app.admin_account SET status = $2 WHERE id = $1 AND status <> $2',
      [id, status],
    );
    return result.rowCount === 1;
  }

  /**
   * A new password hash. Temporary (a reset) means it must be changed at the next sign-in and
   * expires; either way failed attempts and any lockout are cleared.
   */
  async setPassword(
    id: string,
    passwordHash: string,
    temporary: boolean,
    client: Queryable = this.pool,
  ): Promise<void> {
    await client.query(
      `UPDATE app.admin_account
          SET password_hash = $2, must_change_password = $3,
              password_expires_at = CASE WHEN $3 THEN now() + make_interval(hours => $4) END,
              password_changed_at = now(), failed_attempts = 0, locked_until = NULL
        WHERE id = $1`,
      [id, passwordHash, temporary, TEMPORARY_PASSWORD_HOURS],
    );
  }

  /** Clears MFA: the admin enrols a new authenticator at the next sign-in (O-2). */
  async resetMfa(client: TransactionClient, id: string): Promise<void> {
    await client.query(
      `UPDATE app.admin_account
          SET totp_secret = NULL, totp_enrolled_at = NULL, totp_last_step = NULL
        WHERE id = $1`,
      [id],
    );
  }

  async findByEmail(email: string): Promise<AdminAccount | undefined> {
    const { rows } = await this.pool.query<AdminRow>(
      `SELECT ${COLUMNS} FROM app.admin_account WHERE email = $1`,
      [email],
    );
    return rows[0] && toAdmin(rows[0]);
  }

  async findById(id: string, client: Queryable = this.pool): Promise<AdminAccount | undefined> {
    const { rows } = await client.query<AdminRow>(
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
    mustChangePassword: row.must_change_password,
    passwordExpiresAt: row.password_expires_at,
  };
}
