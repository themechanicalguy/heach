import type { FieldEncryptor } from '@heach/crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AccountRepository } from '../accounts/account.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { reason } from '../common/error-response.js';
import type { Principal } from '../common/request-context.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { ApplicationGate } from '../onboarding/application-gate.js';
import { EDITABLE } from '../onboarding/application-rules.js';
import { needsPayout } from '../onboarding/checklists.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import { maskMobile } from '../otp/mobile-number.js';
import { type IssuedChallenge, type OtpOrigin, OtpService } from '../otp/otp.service.js';
import type { AssistedPayoutChallengeDto, AssistedPayoutDto } from './assisted-onboarding.dto.js';
import { AssistedSessionRepository } from './assisted-session.repository.js';
import { type ActiveSession, ASSISTED_ENTITY, AssistedSessions } from './assisted-sessions.js';

/**
 * The payout destination of an assisted provider (PO-06). It is saved only with a second code the
 * provider reads out, sent to the account's own number and good for one save in one session.
 */
@Injectable()
export class AssistedPayoutService {
  constructor(
    private readonly views: AssistedSessions,
    private readonly sessions: AssistedSessionRepository,
    private readonly accounts: AccountRepository,
    private readonly gate: ApplicationGate,
    private readonly onboarding: OnboardingService,
    private readonly otp: OtpService,
    private readonly audit: AuditService,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
  ) {}

  /** Sends the provider a payout code, replacing any earlier one of this session. */
  async requestCode(
    admin: Principal,
    sessionId: string,
    origin: OtpOrigin,
  ): Promise<AssistedPayoutChallengeDto> {
    const session = await this.views.require(admin, sessionId);
    await this.assertPayoutOpen(session);
    const account = await this.accounts.find(session.accountId);
    if (!account?.mobile) throw new NotFoundException();
    const mobile = await this.encryptor.decrypt(account.mobile);
    const issued = await this.otp.issue(
      { mobile, purpose: 'assisted_payout', accountId: account.id, locale: account.locale },
      origin,
    );
    await this.sessions.setPayoutChallenge(session.id, issued.challengeId);
    await this.record('payout_code_requested', session.id);
    return challenge(maskMobile(mobile), issued);
  }

  /** A new code for the challenge this session holds; the browser never names a challenge. */
  async resendCode(
    admin: Principal,
    sessionId: string,
    origin: OtpOrigin,
  ): Promise<AssistedPayoutChallengeDto> {
    const session = await this.views.require(admin, sessionId);
    if (!session.payoutChallengeId) throw reason(ConflictException, 'payout_code_required');
    await this.assertPayoutOpen(session);
    const issued = await this.otp.resend(session.payoutChallengeId, session.locale, origin);
    const mobile = await this.otp.mobileOf(session.payoutChallengeId);
    await this.record('payout_code_resent', session.id);
    return challenge(maskMobile(mobile), issued);
  }

  /** Saves the destination when the code proves the provider agreed; the code is spent first. */
  async save(
    admin: Principal,
    sessionId: string,
    dto: AssistedPayoutDto,
    address: string,
  ): Promise<void> {
    const session = await this.views.require(admin, sessionId);
    if (!session.payoutChallengeId) throw reason(ConflictException, 'payout_code_required');
    await this.assertPayoutOpen(session);
    await this.otp.verify(
      session.payoutChallengeId,
      dto.code,
      { purpose: 'assisted_payout', accountId: session.accountId },
      address,
    );
    if (!(await this.sessions.claimPayoutCode(session.id, session.payoutChallengeId))) {
      throw reason(ConflictException, 'payout_code_required');
    }
    await this.onboarding.savePayout(session.accountId, dto);
    await this.record('payout_saved', session.id);
  }

  /** Checked before a code is sent or spent, so a code is not wasted on a refused save. */
  private async assertPayoutOpen(session: ActiveSession): Promise<void> {
    const grant = await this.gate.grantOf(session.accountId);
    if (!needsPayout(grant.role)) throw reason(ConflictException, 'payout_not_needed');
    if (!EDITABLE.includes(grant.status))
      throw reason(ConflictException, 'application_not_editable');
  }

  private record(op: string, sessionId: string): Promise<void> {
    return this.audit.record({
      action: `onboarding.assisted.${op}`,
      entity: ASSISTED_ENTITY,
      entityId: sessionId,
    });
  }
}

function challenge(mobile: string, issued: IssuedChallenge): AssistedPayoutChallengeDto {
  return {
    mobile,
    expiresInSeconds: issued.expiresInSeconds,
    resendInSeconds: issued.resendInSeconds,
  };
}
