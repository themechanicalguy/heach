import type { EncryptedField } from '@heach/crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import type { AccountStatus, RoleGrant } from '../accounts/account.repository.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { type TransactionClient, withTransaction } from '../data-stores/transaction.js';

export interface UserSummaryRow {
  id: string;
  full_name: string | null;
  mobile: EncryptedField | null;
  status: AccountStatus;
  suspension_reason: string | null;
  created_at: Date;
  last_sign_in_at: Date | null;
  setup_completed_at: Date | null;
  roles: RoleGrant[];
}

export interface UserQuery {
  /** Blind index of a mobile number, or a fragment of a name. */
  mobileIndex?: string;
  name?: string;
  status?: AccountStatus;
  limit: number;
  offset: number;
}

const SUMMARY = `
  SELECT a.id, p.full_name, a.mobile, a.status, a.suspension_reason, a.created_at,
         a.last_sign_in_at, a.setup_completed_at,
         coalesce((SELECT json_agg(json_build_object(
                     'role', r.role, 'side', r.side, 'applicationStatus', r.application_status,
                     'statusReason', r.status_reason) ORDER BY r.side)
                     FROM app.role_assignment r WHERE r.account_id = a.id), '[]') AS roles
    FROM app.account a JOIN app.account_profile p ON p.account_id = a.id`;

// Each filter is off when its parameter is null; values never go into the text.
const SEARCH_FILTER = `WHERE a.synthetic = false
                         AND ($1::text IS NULL OR a.mobile_index = $1)
                         AND ($2::text IS NULL OR p.full_name ILIKE $2)
                         AND ($3::text IS NULL OR a.status = $3)`;
const SEARCH_PAGE = `${SUMMARY} ${SEARCH_FILTER}
  ORDER BY a.created_at DESC, a.id LIMIT $4 OFFSET $5`;
const SEARCH_COUNT = `SELECT count(*) AS total FROM app.account a
  JOIN app.account_profile p ON p.account_id = a.id ${SEARCH_FILTER}`;
const FIND_ONE = `${SUMMARY} WHERE a.id = $1`;

/** Patient and provider accounts as admins see them (AD-03); masking happens in the service. */
@Injectable()
export class AdminUsersRepository {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  transaction<T>(work: (client: TransactionClient) => Promise<T>): Promise<T> {
    return withTransaction(this.pool, work);
  }

  /** One page, newest first, with the total for pagination on the server. */
  async search(query: UserQuery): Promise<{ rows: UserSummaryRow[]; total: number }> {
    const params = [
      query.mobileIndex ?? null,
      query.name ? `%${escapeLike(query.name)}%` : null,
      query.status ?? null,
    ];
    const [page, count] = await Promise.all([
      this.pool.query<UserSummaryRow>(SEARCH_PAGE, [...params, query.limit, query.offset]),
      this.pool.query<{ total: string }>(SEARCH_COUNT, params),
    ]);
    return { rows: page.rows, total: Number(count.rows[0]?.total ?? 0) };
  }

  async find(id: string): Promise<UserSummaryRow | undefined> {
    const { rows } = await this.pool.query<UserSummaryRow>(FIND_ONE, [id]);
    return rows[0];
  }

  /** Changes the status only from the other one; false if the account was already there. */
  async setStatus(
    client: TransactionClient,
    id: string,
    change: { status: AccountStatus; reason: string | null },
  ): Promise<boolean> {
    const result = await client.query(
      `UPDATE app.account SET status = $2, suspension_reason = $3
        WHERE id = $1 AND synthetic = false AND status <> $2`,
      [id, change.status, change.reason],
    );
    return result.rowCount === 1;
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
