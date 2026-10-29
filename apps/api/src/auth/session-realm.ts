import type { Realm } from '../common/request-context.js';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * Where a realm keeps its sessions and how long they live (decision L-10). Table names are
 * constants, never input. `lockSession` returns the session with its owner's *current* role: the
 * active role while the account is active and still holds it, otherwise null, so a suspension or a
 * removed role ends the session at its next refresh.
 */
export interface SessionRealm {
  readonly name: Realm;
  readonly sessionTable: 'app.session' | 'app.admin_session';
  readonly ownerTable: 'app.account' | 'app.admin_account';
  readonly lockSession: string;
  /** Sliding lifetime of a refresh token. */
  readonly refreshTtlMs: number;
  /** Longest a device's chain of refreshes may run before a new sign-in; undefined: no limit. */
  readonly absoluteTtlMs: number | undefined;
  readonly accessTtlSeconds: number;
  readonly cookieName: string;
  /** The path the browser sees; hosts and the web app strip `/api` before the API. */
  readonly cookiePath: string;
}

const SESSION_COLUMNS =
  's.id, s.user_id, s.family_id, s.family_started_at, s.active_role, s.expires_at, s.revoked_at';

/** Patients and providers: sessions persist on the device (AC-05), 15-minute access (SE-07.1). */
export const USER_REALM: SessionRealm = {
  name: 'user',
  sessionTable: 'app.session',
  ownerTable: 'app.account',
  lockSession: `SELECT ${SESSION_COLUMNS},
                       CASE WHEN a.status <> 'active' THEN NULL
                            WHEN s.active_role = 'new_account' THEN s.active_role
                            ELSE r.role END AS role
                  FROM app.session s
                  JOIN app.account a ON a.id = s.user_id
                  LEFT JOIN app.role_assignment r
                    ON r.account_id = a.id AND r.role = s.active_role
                 WHERE s.refresh_token_hash = $1
                   FOR UPDATE OF s`,
  refreshTtlMs: 30 * DAY_MS,
  absoluteTtlMs: undefined,
  accessTtlSeconds: 15 * 60,
  cookieName: 'heach_refresh',
  cookiePath: '/api/v1/auth',
};

/** Admins: short sessions (SE-04): 10-minute access, 30 minutes idle, 8 hours at most. */
export const ADMIN_REALM: SessionRealm = {
  name: 'admin',
  sessionTable: 'app.admin_session',
  ownerTable: 'app.admin_account',
  lockSession: `SELECT ${SESSION_COLUMNS},
                       CASE WHEN a.status = 'active' THEN a.role END AS role
                  FROM app.admin_session s
                  JOIN app.admin_account a ON a.id = s.user_id
                 WHERE s.refresh_token_hash = $1
                   FOR UPDATE OF s`,
  refreshTtlMs: 30 * MINUTE_MS,
  absoluteTtlMs: 8 * 60 * MINUTE_MS,
  accessTtlSeconds: 10 * 60,
  cookieName: 'heach_admin_refresh',
  cookiePath: '/api/admin/v1/auth',
};
