import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { reason } from '../common/error-response.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { isOnboardingRole, type OnboardingRole } from './checklists.js';

/** Only Approved providers with an active account list, publish or take work (scope, AD-02). */
@Injectable()
export class ProviderAccess {
  constructor(@Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>) {}

  async approvedRole(accountId: string): Promise<OnboardingRole> {
    const { rows } = await this.pool.query<{ role: string }>(
      `SELECT r.role FROM app.role_assignment r JOIN app.account a ON a.id = r.account_id
        WHERE r.account_id = $1 AND r.side = 'provider' AND r.application_status = 'approved'
          AND a.status = 'active'`,
      [accountId],
    );
    const role = rows[0]?.role;
    if (!role || !isOnboardingRole(role)) throw reason(ForbiddenException, 'provider_not_approved');
    return role;
  }
}
