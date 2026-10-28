import type pg from 'pg';
import type { Role } from '../common/request-context.js';
import { type TransactionClient, withTransaction } from '../data-stores/transaction.js';
import type { SessionRealm } from './session-realm.js';

export interface SessionRow {
  id: string;
  user_id: string;
  family_id: string;
  family_started_at: Date;
  active_role: Role;
  /** The owner's current role for this session; null once suspended or the role is removed. */
  role: Role | null;
  expires_at: Date;
  revoked_at: Date | null;
}

export interface NewSession {
  id: string;
  userId: string;
  familyId: string;
  familyStartedAt: Date;
  role: Role;
  hash: string;
  expiresAt: Date;
}

type Queryable = Pick<pg.Pool, 'query'>;

// A replay waiting behind another rotation of the same user gives up after this (spec 004 D-3).
const LOCK_TIMEOUT = "SET LOCAL lock_timeout = '5s'";

/**
 * Sessions hold only the SHA-256 of the refresh token (Confidential), never the token. Rotation,
 * replay handling and sign-out of all devices lock the owner's row, so they run one at a time per
 * owner (spec 004 D-1, D-2). One instance per realm (decision L-10).
 */
export class SessionRepository {
  private readonly table: string;

  constructor(
    private readonly pool: pg.Pool,
    private readonly realm: SessionRealm,
  ) {
    this.table = realm.sessionTable;
  }

  transaction<T>(work: (client: TransactionClient) => Promise<T>): Promise<T> {
    return withTransaction(this.pool, work);
  }

  async create(session: NewSession, client: Queryable = this.pool): Promise<void> {
    await client.query(
      `INSERT INTO ${this.table} (id, user_id, family_id, family_started_at, active_role,
                                  refresh_token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        session.id,
        session.userId,
        session.familyId,
        session.familyStartedAt,
        session.role,
        session.hash,
        session.expiresAt,
      ],
    );
  }

  /** The active role of one live session, so its refreshes keep the role switched to. */
  async setActiveRole(client: TransactionClient, sessionId: string, role: Role): Promise<boolean> {
    const result = await client.query(
      `UPDATE ${this.table} SET active_role = $2 WHERE id = $1 AND revoked_at IS NULL`,
      [sessionId, role],
    );
    return result.rowCount === 1;
  }

  /**
   * The session for this token hash, with its user's row and then it locked until commit. The user
   * comes first, as in sign-out: locking both rows in one statement can take the session first and
   * deadlock with a sign-out that holds the user and updates the session (SE-07.22).
   */
  async lockByHash(client: TransactionClient, hash: string): Promise<SessionRow | undefined> {
    const { rows: owners } = await client.query<{ user_id: string }>(
      `SELECT user_id FROM ${this.table} WHERE refresh_token_hash = $1`,
      [hash],
    );
    const owner = owners[0];
    if (!owner) return undefined;
    await this.lockUser(client, owner.user_id);
    const { rows } = await client.query<SessionRow>(this.realm.lockSession, [hash]);
    return rows[0];
  }

  /** Locks the owner's row until commit, as rotation does. */
  async lockUser(client: TransactionClient, userId: string): Promise<void> {
    await client.query(LOCK_TIMEOUT);
    await client.query(`SELECT 1 FROM ${this.realm.ownerTable} WHERE id = $1 FOR UPDATE`, [userId]);
  }

  /** Marks one session used; false if another request used it first. */
  async revokeIfActive(id: string, client: Queryable = this.pool): Promise<boolean> {
    const result = await client.query(
      `UPDATE ${this.table} SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`,
      [id],
    );
    return result.rowCount === 1;
  }

  /** The session family (one device's chain of refreshes) a session belongs to. */
  async familyOf(client: TransactionClient, sessionId: string): Promise<string | undefined> {
    const { rows } = await client.query<{ family_id: string }>(
      `SELECT family_id FROM ${this.table} WHERE id = $1`,
      [sessionId],
    );
    return rows[0]?.family_id;
  }

  async revokeFamily(client: TransactionClient, familyId: string): Promise<void> {
    await client.query(
      `UPDATE ${this.table} SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL`,
      [familyId],
    );
  }

  /** True while the family still has a session that can refresh. */
  async familyIsLive(client: TransactionClient, familyId: string): Promise<boolean> {
    const { rows } = await client.query<{ live: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM ${this.table}
                       WHERE family_id = $1 AND revoked_at IS NULL AND expires_at > now()) AS live`,
      [familyId],
    );
    return rows[0]?.live === true;
  }

  async revokeAllForUser(userId: string, client: Queryable = this.pool): Promise<void> {
    await client.query(
      `UPDATE ${this.table} SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  }
}
