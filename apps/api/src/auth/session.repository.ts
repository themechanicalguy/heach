import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import type { Role } from '../common/request-context.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { type TransactionClient, withTransaction } from '../data-stores/transaction.js';

export interface SessionRow {
  id: string;
  user_id: string;
  family_id: string;
  role: Role;
  expires_at: Date;
  revoked_at: Date | null;
}

type Queryable = Pick<pg.Pool, 'query'>;

// A replay waiting behind another rotation of the same user gives up after this (spec 004 D-3).
const LOCK_TIMEOUT = "SET LOCAL lock_timeout = '5s'";

/**
 * Sessions hold only the SHA-256 of the refresh token (Confidential), never the token. Rotation,
 * replay handling and sign-out of all devices lock the user's row, so they run one at a time per
 * user (spec 004 D-1, D-2).
 */
@Injectable()
export class SessionRepository {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  transaction<T>(work: (client: TransactionClient) => Promise<T>): Promise<T> {
    return withTransaction(this.pool, work);
  }

  async findUserRole(userId: string): Promise<Role | undefined> {
    const { rows } = await this.pool.query<{ role: Role }>(
      'SELECT role FROM app.user_test WHERE id = $1',
      [userId],
    );
    return rows[0]?.role;
  }

  async create(
    session: { id: string; userId: string; familyId: string; hash: string; expiresAt: Date },
    client: Queryable = this.pool,
  ): Promise<void> {
    await client.query(
      'INSERT INTO app.session (id, user_id, family_id, refresh_token_hash, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [session.id, session.userId, session.familyId, session.hash, session.expiresAt],
    );
  }

  /** The session for this token hash, with it and its user's row locked until commit. */
  async lockByHash(client: TransactionClient, hash: string): Promise<SessionRow | undefined> {
    await client.query(LOCK_TIMEOUT);
    const { rows } = await client.query<SessionRow>(
      `SELECT s.id, s.user_id, s.family_id, u.role, s.expires_at, s.revoked_at
         FROM app.session s JOIN app.user_test u ON u.id = s.user_id
        WHERE s.refresh_token_hash = $1
          FOR UPDATE`,
      [hash],
    );
    return rows[0];
  }

  /** Locks the user's row until commit, as rotation does. */
  async lockUser(client: TransactionClient, userId: string): Promise<void> {
    await client.query(LOCK_TIMEOUT);
    await client.query('SELECT 1 FROM app.user_test WHERE id = $1 FOR UPDATE', [userId]);
  }

  /** Marks one session used; false if another request used it first. */
  async revokeIfActive(id: string, client: Queryable = this.pool): Promise<boolean> {
    const result = await client.query(
      'UPDATE app.session SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL',
      [id],
    );
    return result.rowCount === 1;
  }

  async revokeAllForUser(userId: string, client: Queryable = this.pool): Promise<void> {
    await client.query(
      'UPDATE app.session SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId],
    );
  }
}
