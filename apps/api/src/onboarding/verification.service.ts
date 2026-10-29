import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ApplicationStatus } from '../accounts/account.repository.js';
import type { SmsTemplate } from '../adapters/sms.port.js';
import { AuditService } from '../audit/audit.service.js';
import { reason } from '../common/error-response.js';
import type { Principal } from '../common/request-context.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { Notifier } from '../notifications/notifier.service.js';
import { UploadsService } from '../uploads/uploads.service.js';
import { decide, opensReview } from './application-rules.js';
import { ApplicationView } from './application-view.js';
import { isOnboardingRole, type OnboardingRole } from './checklists.js';
import type {
  ApplicationReviewDto,
  ApplicationSummaryDto,
  DecisionDto,
  DocumentReviewDto,
  StoredFileDto,
} from './onboarding.dto.js';
import { OnboardingRepository } from './onboarding.repository.js';

const ENTITY = 'provider_application';
const OPEN: readonly ApplicationStatus[] = ['submitted', 'under_review'];
const DECIDED: readonly ApplicationStatus[] = ['approved', 'rejected', 'changes_requested'];
const OUTCOME_SMS: Partial<Record<ApplicationStatus, SmsTemplate>> = {
  approved: 'application_approved',
  rejected: 'application_rejected',
  changes_requested: 'application_changes_requested',
};

/**
 * The admin verification queue (AD-02, J5). Opening a submitted application starts its review;
 * every document opened and every decision is audited (AD-11) and the provider is told by SMS
 * without any detail of why (NT-01, SE-09).
 */
@Injectable()
export class VerificationService {
  constructor(
    private readonly onboarding: OnboardingRepository,
    private readonly view: ApplicationView,
    private readonly uploads: UploadsService,
    private readonly audit: AuditService,
    private readonly notifier: Notifier,
  ) {}

  queue(view: 'open' | 'decided' = 'open'): Promise<ApplicationSummaryDto[]> {
    return this.onboarding.queue(view === 'open' ? OPEN : DECIDED);
  }

  async review(admin: Principal, accountId: string): Promise<ApplicationReviewDto> {
    await this.onboarding.transaction(async (client) => {
      const grant = await this.grant(accountId, client);
      if (opensReview(grant.status)) {
        await this.change(client, admin, accountId, {
          from: grant.status,
          to: 'under_review',
          reason: null,
        });
      }
      await this.record('viewed', accountId, client);
    });
    const grant = await this.grant(accountId);
    const [application, fullName, history] = await Promise.all([
      this.view.build(accountId, grant),
      this.onboarding.fullName(accountId),
      this.onboarding.history(accountId),
    ]);
    return Object.assign(application, { accountId, fullName, history });
  }

  async document(accountId: string, documentId: string): Promise<StoredFileDto> {
    const document = await this.onboarding.document(accountId, documentId);
    const file = document && (await this.uploads.read(document.objectId));
    if (!file) throw new NotFoundException();
    await this.audit.record({
      action: 'provider_document.opened',
      entity: ENTITY,
      entityId: documentId,
    });
    return file;
  }

  async reviewDocument(accountId: string, input: DocumentReviewDto): Promise<void> {
    await this.onboarding.transaction(async (client) => {
      await this.reviewing(accountId, client);
      const review = {
        status: input.status,
        reason: input.status === 'rejected' ? (input.reason ?? null) : null,
      };
      if (!(await this.onboarding.reviewDocument(client, accountId, input.documentId, review))) {
        throw new NotFoundException();
      }
      await this.audit.record(
        { action: `provider_document.${input.status}`, entity: ENTITY, entityId: input.documentId },
        client,
      );
    });
  }

  async decide(admin: Principal, accountId: string, input: DecisionDto): Promise<void> {
    const to = await this.onboarding.transaction(async (client) => {
      const grant = await this.grant(accountId, client);
      const next = decide(grant.status, input.decision);
      if (!next) throw reason(ConflictException, 'application_not_in_review');
      const why = input.decision === 'approve' ? null : (input.reason ?? null);
      await this.change(client, admin, accountId, { from: grant.status, to: next, reason: why });
      await this.record(input.decision, accountId, client);
      return next;
    });
    const template = OUTCOME_SMS[to];
    if (template) await this.notifier.smsAccount(accountId, template);
  }

  private async reviewing(accountId: string, client: TransactionClient): Promise<void> {
    const grant = await this.grant(accountId, client);
    if (grant.status !== 'under_review')
      throw reason(ConflictException, 'application_not_in_review');
  }

  private async grant(accountId: string, client?: TransactionClient) {
    const grant = await this.onboarding.grant(accountId, client);
    if (!grant || !isOnboardingRole(grant.role)) throw new NotFoundException();
    return grant as typeof grant & { role: OnboardingRole };
  }

  private change(
    client: TransactionClient,
    admin: Principal,
    accountId: string,
    change: { from: ApplicationStatus; to: ApplicationStatus; reason: string | null },
  ): Promise<void> {
    return this.onboarding.changeStatus(client, accountId, {
      ...change,
      actorId: admin.userId,
      actorRole: admin.role,
    });
  }

  private record(action: string, accountId: string, client: TransactionClient): Promise<void> {
    return this.audit.record(
      { action: `${ENTITY}.${action}`, entity: ENTITY, entityId: accountId },
      client,
    );
  }
}
