import type { FieldEncryptor } from '@heach/crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AccountRepository } from '../accounts/account.repository.js';
import { maskName } from '../admin/masking.js';
import { AuditService } from '../audit/audit.service.js';
import { reason } from '../common/error-response.js';
import type { Principal } from '../common/request-context.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { isOnboardingRole } from '../onboarding/checklists.js';
import { OnboardingRepository } from '../onboarding/onboarding.repository.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import { maskMobile } from '../otp/mobile-number.js';
import type { AssistedApplicationDto, AssistedSessionDto } from './assisted-onboarding.dto.js';
import { toAssistedView } from './assisted-rules.js';
import {
  type AssistedSessionRow,
  AssistedSessionRepository,
} from './assisted-session.repository.js';

export const ASSISTED_ENTITY = 'assisted_session';

/** A consented session that is running and belongs to the calling admin. */
export type ActiveSession = AssistedSessionRow & { accountId: string };

/**
 * The gate every assisted route passes first, and the admin's view of a session (AD-12).
 * A session is the admin's own, consented, unexpired, not ended, and its account not suspended.
 */
@Injectable()
export class AssistedSessions {
  constructor(
    private readonly sessions: AssistedSessionRepository,
    private readonly accounts: AccountRepository,
    private readonly onboarding: OnboardingRepository,
    private readonly applications: OnboardingService,
    private readonly audit: AuditService,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
  ) {}

  /** Another admin's, unknown or not-yet-consented session is 404; one that is over is 409. */
  async require(admin: Principal, sessionId: string): Promise<ActiveSession> {
    const row = await this.sessions.find(sessionId, admin.userId);
    if (!row?.accountId) throw new NotFoundException();
    if (row.endedAt || row.expired || row.accountSuspended) {
      throw reason(ConflictException, 'assisted_session_ended');
    }
    return { ...row, accountId: row.accountId };
  }

  /** The admin's running session, or 404 so the screen shows its start step. */
  async current(admin: Principal): Promise<AssistedSessionDto> {
    const row = await this.sessions.openFor(admin.userId);
    if (!row?.accountId || row.accountSuspended) throw new NotFoundException();
    return this.view({ ...row, accountId: row.accountId });
  }

  /** Ends the admin's own session. Ending one that is over is not an error. */
  async end(admin: Principal, sessionId: string): Promise<void> {
    const row = await this.sessions.find(sessionId, admin.userId);
    if (!row) throw new NotFoundException();
    if (await this.sessions.end(row.id, 'ended')) {
      await this.audit.record({
        action: 'onboarding.assisted.session_ended',
        entity: ASSISTED_ENTITY,
        entityId: row.id,
      });
    }
  }

  async view(session: ActiveSession, ended = false): Promise<AssistedSessionDto> {
    const account = await this.accounts.find(session.accountId);
    if (!account?.mobile) throw new NotFoundException();
    return {
      sessionId: session.id,
      mobile: maskMobile(await this.encryptor.decrypt(account.mobile)),
      maskedName: maskName(account.draft.fullName),
      expiresAt: session.expiresAt,
      ended,
      accountCreated: session.accountCreated,
      setupComplete: account.setupCompletedAt !== null,
      basicDetailsLocked: account.setupCompletedAt !== null,
      payoutCodeSent: session.payoutChallengeId !== null,
      application: await this.applicationOf(session.accountId),
    };
  }

  /** The application the admin may see; null before the account has a provider side. */
  private async applicationOf(accountId: string): Promise<AssistedApplicationDto | null> {
    const grant = await this.onboarding.grant(accountId);
    if (!grant || !isOnboardingRole(grant.role)) return null;
    return toAssistedView(await this.applications.application(accountId));
  }
}
