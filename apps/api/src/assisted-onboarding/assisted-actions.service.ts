import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../common/request-context.js';
import { IdentityService } from '../onboarding/identity.service.js';
import type {
  DocumentUploadDto,
  ProviderProfileInputDto,
  UploadDto,
} from '../onboarding/onboarding.dto.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import { ProfileService } from '../onboarding/profile.service.js';
import { Notifier } from '../notifications/notifier.service.js';
import { AssistedDetailsService } from './assisted-details.service.js';
import type {
  AssistedDetailsDto,
  AssistedIdentityDocumentDto,
  AssistedSessionDto,
} from './assisted-onboarding.dto.js';
import { AssistedSessionRepository } from './assisted-session.repository.js';
import { type ActiveSession, ASSISTED_ENTITY, AssistedSessions } from './assisted-sessions.js';

/**
 * What a support admin does for a consented provider (AD-12): the provider's own onboarding
 * services run on the provider's account, and each step is audited against the session. Every
 * answer is the masked session view; nothing entered is ever read back.
 */
@Injectable()
export class AssistedActionsService {
  constructor(
    private readonly views: AssistedSessions,
    private readonly sessions: AssistedSessionRepository,
    private readonly details: AssistedDetailsService,
    private readonly onboarding: OnboardingService,
    private readonly identity: IdentityService,
    private readonly profile: ProfileService,
    private readonly notifier: Notifier,
    private readonly audit: AuditService,
  ) {}

  saveDetails(admin: Principal, sessionId: string, dto: AssistedDetailsDto) {
    return this.act(admin, sessionId, 'details_saved', (s) => this.details.save(s.accountId, dto));
  }

  uploadDocument(admin: Principal, sessionId: string, item: string, dto: DocumentUploadDto) {
    return this.act(admin, sessionId, 'document_uploaded', async (s) => {
      await this.onboarding.upload(s.accountId, item, dto);
    });
  }

  uploadIdentityDocument(admin: Principal, sessionId: string, dto: AssistedIdentityDocumentDto) {
    return this.act(admin, sessionId, 'identity_document_uploaded', (s) =>
      this.identity.uploadDocument(s.accountId, dto, s.id),
    );
  }

  saveProfile(admin: Principal, sessionId: string, dto: ProviderProfileInputDto) {
    return this.act(admin, sessionId, 'profile_saved', async (s) => {
      await this.profile.save(s.accountId, dto);
    });
  }

  uploadPhoto(admin: Principal, sessionId: string, dto: UploadDto) {
    return this.act(admin, sessionId, 'photo_uploaded', async (s) => {
      await this.profile.uploadPhoto(s.accountId, dto);
    });
  }

  /** The admin's view after a payout save; the payout service has already audited it. */
  view(admin: Principal, sessionId: string): Promise<AssistedSessionDto> {
    return this.views.require(admin, sessionId).then((session) => this.views.view(session));
  }

  /** Submits for the provider, ends the session and tells the provider (PO-04). */
  async submit(admin: Principal, sessionId: string): Promise<AssistedSessionDto> {
    const session = await this.views.require(admin, sessionId);
    await this.onboarding.submit(session.accountId, admin);
    await this.sessions.end(session.id, 'submitted');
    await this.record('submitted', session.id);
    await this.notifier.notify(session.accountId, 'application_assisted_submitted');
    return this.views.view({ ...session, payoutChallengeId: null }, true);
  }

  private async act(
    admin: Principal,
    sessionId: string,
    op: string,
    work: (session: ActiveSession) => Promise<void>,
  ): Promise<AssistedSessionDto> {
    const session = await this.views.require(admin, sessionId);
    await work(session);
    await this.record(op, session.id);
    return this.views.view(session);
  }

  private record(op: string, sessionId: string): Promise<void> {
    return this.audit.record({
      action: `onboarding.assisted.${op}`,
      entity: ASSISTED_ENTITY,
      entityId: sessionId,
    });
  }
}
