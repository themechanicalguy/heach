import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountRepository } from '../accounts/account.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { reason } from '../common/error-response.js';
import type { Principal } from '../common/request-context.js';
import { RoleAvailability } from '../flags/role-availability.js';
import { maskMobile, normaliseIndianMobile } from '../otp/mobile-number.js';
import { type IssuedChallenge, type OtpOrigin, OtpService } from '../otp/otp.service.js';
import type {
  AssistedChallengeDto,
  AssistedConsentRequestDto,
  AssistedSessionDto,
} from './assisted-onboarding.dto.js';
import { type ConsentRefusal, consentRefusal } from './assisted-rules.js';
import {
  AssistedSessionRepository,
  type AssistedSessionRow,
} from './assisted-session.repository.js';
import { ASSISTED_ENTITY, AssistedSessions } from './assisted-sessions.js';

/**
 * The provider's consent to assistance, given by reading out an SMS code (AD-12). The number is
 * never stored by the session: before consent it lives in the encrypted OTP challenge only.
 * Whether a number already has an account is not revealed until the code is proven.
 */
@Injectable()
export class AssistedConsentService {
  constructor(
    private readonly sessions: AssistedSessionRepository,
    private readonly views: AssistedSessions,
    private readonly otp: OtpService,
    private readonly accounts: AccountRepository,
    private readonly roles: RoleAvailability,
    private readonly audit: AuditService,
  ) {}

  async request(
    admin: Principal,
    dto: AssistedConsentRequestDto,
    origin: OtpOrigin,
  ): Promise<AssistedChallengeDto> {
    const mobile = normaliseIndianMobile(dto.mobile);
    if (!mobile) throw reason(BadRequestException, 'mobile_invalid');
    if (await this.sessions.openFor(admin.userId)) {
      throw reason(ConflictException, 'assisted_session_open');
    }
    const issued = await this.otp.issue(
      { mobile, purpose: 'assisted_consent', accountId: null, locale: dto.locale },
      origin,
    );
    const sessionId = await this.sessions.createPending({
      adminId: admin.userId,
      consentChallengeId: issued.challengeId,
      locale: dto.locale,
    });
    await this.record('consent_requested', sessionId);
    return challenge(sessionId, maskMobile(mobile), issued);
  }

  /** A new code for the admin's own pending request; the browser never names a challenge. */
  async resend(
    admin: Principal,
    sessionId: string,
    origin: OtpOrigin,
  ): Promise<AssistedChallengeDto> {
    const row = await this.sessions.pending(sessionId, admin.userId);
    if (!row) throw new NotFoundException();
    const issued = await this.otp.resend(row.consentChallengeId, row.locale, origin);
    const mobile = await this.otp.mobileOf(row.consentChallengeId);
    await this.record('consent_resent', row.id);
    return challenge(row.id, maskMobile(mobile), issued);
  }

  /** Checks the code the provider read out; a good code opens the session on their account. */
  async verify(
    admin: Principal,
    sessionId: string,
    code: string,
    address: string,
  ): Promise<AssistedSessionDto> {
    const row = await this.sessions.pending(sessionId, admin.userId);
    if (!row) throw new NotFoundException();
    const verified = await this.otp.verify(
      row.consentChallengeId,
      code,
      { purpose: 'assisted_consent' },
      address,
    );
    const { id: accountId, created } = await this.accounts.findOrCreate(verified, row.locale);
    await this.refuseIfNotAllowed(row, accountId);
    await this.open(row, accountId, created);
    return this.views.view({ ...row, accountId, accountCreated: created }, false);
  }

  private async refuseIfNotAllowed(row: AssistedSessionRow, accountId: string): Promise<void> {
    const account = await this.accounts.find(accountId);
    const refusal = account && consentRefusal(account, (role) => this.roles.isOffered(role));
    if (!refusal) return;
    await this.sessions.end(row.id, 'refused');
    await this.record('consent_refused', row.id);
    throw refusalError(refusal);
  }

  /** Opens the session under the account row lock, so two admins cannot both hold one account. */
  private async open(row: AssistedSessionRow, accountId: string, created: boolean): Promise<void> {
    await this.sessions.transaction(async (client) => {
      await client.query('SELECT 1 FROM app.account WHERE id = $1 FOR UPDATE', [accountId]);
      const opened = await this.sessions.open(client, {
        id: row.id,
        accountId,
        accountCreated: created,
      });
      if (!opened) throw reason(ConflictException, 'assisted_session_open');
      await this.audit.record(
        { action: 'onboarding.assisted.session_opened', entity: ASSISTED_ENTITY, entityId: row.id },
        client,
      );
      if (created) {
        await this.audit.record(
          { action: 'account.created', entity: 'account', entityId: accountId },
          client,
        );
      }
    });
  }

  private record(op: string, sessionId: string): Promise<void> {
    return this.audit.record({
      action: `onboarding.assisted.${op}`,
      entity: ASSISTED_ENTITY,
      entityId: sessionId,
    });
  }
}

function challenge(
  sessionId: string,
  mobile: string,
  issued: IssuedChallenge,
): AssistedChallengeDto {
  return {
    sessionId,
    mobile,
    expiresInSeconds: issued.expiresInSeconds,
    resendInSeconds: issued.resendInSeconds,
  };
}

function refusalError(refusal: ConsentRefusal): Error {
  return reason(refusal.status === 403 ? ForbiddenException : ConflictException, refusal.code);
}
