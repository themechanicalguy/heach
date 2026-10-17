import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import type { Role } from '../common/request-context.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';

export interface SessionRow {
  id: string;
  user_id: string;
  family_id: string;
  role: Role;
  expires_at: Date;
  revoked_at: Date | null;
}

/** Sessions hold only the SHA-256 of the refresh token (Confidential), never the token. */
@Injectable()
export class SessionRepository {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async findUserRole(userId: string): Promise<Role | undefined> {
    const { rows } = await this.pool.query<{ role: Role }>(
      'SELECT role FROM app.user_test WHERE id = $1',
      [userId],
    );
    return rows[0]?.role;
  }

  async create(session: {
    id: string;
    userId: string;
    familyId: string;
    hash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.pool.query(
      'INSERT INTO app.session (id, user_id, family_id, refresh_token_hash, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [session.id, session.userId, session.familyId, session.hash, session.expiresAt],
    );
  }

  async findByHash(hash: string): Promise<SessionRow | undefined> {
    const { rows } = await this.pool.query<SessionRow>(
      `SELECT s.id, s.user_id, s.family_id, u.role, s.expires_at, s.revoked_at
         FROM app.session s JOIN app.user_test u ON u.id = s.user_id
        WHERE s.refresh_token_hash = $1`,
      [hash],
    );
    return rows[0];
  }

  /** Marks one session used; false if another request used it first. */
  async revokeIfActive(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE app.session SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL',
      [id],
    );
    return result.rowCount === 1;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.pool.query(
      'UPDATE app.session SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId],
    );
  }
}
