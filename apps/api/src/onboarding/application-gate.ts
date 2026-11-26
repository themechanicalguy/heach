import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { reason } from '../common/error-response.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { EDITABLE } from './application-rules.js';
import { isOnboardingRole, type OnboardingRole } from './checklists.js';
import { OnboardingRepository, type ProviderGrant } from './onboarding.repository.js';

export type OnboardingGrant = ProviderGrant & { role: OnboardingRole };

/** Finds the provider's application and lets changes through only while it is editable (PO-04). */
@Injectable()
export class ApplicationGate {
  constructor(private readonly onboarding: OnboardingRepository) {}

  /** The provider grant; locked for the transaction when a client is given. */
  async grantOf(accountId: string, client?: TransactionClient): Promise<OnboardingGrant> {
    const grant = await this.onboarding.grant(accountId, client);
    if (!grant || !isOnboardingRole(grant.role)) throw new NotFoundException();
    return grant as OnboardingGrant;
  }

  /** Runs a change only while the application is editable, under the grant's row lock. */
  editable<T>(accountId: string, work: (client: TransactionClient) => Promise<T>): Promise<T> {
    return this.onboarding.transaction(async (client) => {
      const grant = await this.grantOf(accountId, client);
      if (!EDITABLE.includes(grant.status))
        throw reason(ConflictException, 'application_not_editable');
      return work(client);
    });
  }
}
