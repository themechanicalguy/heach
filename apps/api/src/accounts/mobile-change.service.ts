import type { FieldEncryptor } from '@heach/crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { SessionService } from '../auth/session.service.js';
import { reason } from '../common/error-response.js';
import type { Principal } from '../common/request-context.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { normaliseIndianMobile } from '../otp/mobile-number.js';
import { type IssuedChallenge, type OtpOrigin, OtpService } from '../otp/otp.service.js';
import { AccountRepository } from './account.repository.js';

/** Postgres unique violation: another account took the number between check and update. */
const UNIQUE_VIOLATION = '23505';

/**
 * Moving an account to a new mobile number (owner decision O-3). The start route requires a
 * fresh OTP on the current number; this service then proves the new number with its own code,
 * moves the account under its lock and signs every other device out. A lost old number is a
 * support matter, not built here.
 */
@Injectable()
export class MobileChangeService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
  ) {}

  async start(principal: Principal, input: string, origin: OtpOrigin): Promise<IssuedChallenge> {
    const mobile = normaliseIndianMobile(input);
    if (!mobile) throw reason(BadRequestException, 'mobile_invalid');
    const account = await this.accounts.find(principal.userId);
    if (!account?.mobile) throw reason(ForbiddenException, 'no_mobile');
    if ((await this.encryptor.decrypt(account.mobile)) === mobile) {
      throw reason(ConflictException, 'mobile_unchanged');
    }
    const target = { mobile, purpose: 'change_mobile' as const, accountId: account.id };
    return this.otp.issue({ ...target, locale: account.locale }, origin);
  }

  /**
   * The code proves the caller holds the new number, so saying it belongs to another account
   * tells them nothing they could not learn by signing in with it.
   */
  async verify(principal: Principal, challengeId: string, code: string, address: string) {
    const expected = { purpose: 'change_mobile' as const, accountId: principal.userId };
    const verified = await this.otp.verify(challengeId, code, expected, address);
    try {
      await this.accounts.transaction(async (client) => {
        await client.query('SELECT 1 FROM app.account WHERE id = $1 FOR UPDATE', [
          principal.userId,
        ]);
        if (!(await this.accounts.changeMobile(client, principal.userId, verified))) {
          throw reason(ConflictException, 'mobile_in_use');
        }
        await this.audit.record(
          { action: 'account.mobile.changed', entity: 'account', entityId: principal.userId },
          client,
        );
      });
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw reason(ConflictException, 'mobile_in_use');
      }
      throw error;
    }
    await this.sessions.signOutOtherDevices(principal);
  }
}
