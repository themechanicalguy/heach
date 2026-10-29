import { randomUUID } from 'node:crypto';
import type { BlindIndexer, EncryptedField, FieldEncryptor } from '@heach/crypto';
import type { Locale } from '@heach/i18n';
import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SMS_SENDER, type SmsSender } from '../adapters/sms.port.js';
import { appLogger } from '../common/app-logger.js';
import { BLIND_INDEXER, FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { newOtpCode, OTP_POLICY, OtpHasher } from './otp-code.js';
import { OtpRateLimitedException, OtpThrottle } from './otp-throttle.js';
import { type OtpChallengeRow, type OtpPurpose, OtpRepository } from './otp.repository.js';

export interface IssuedChallenge {
  challengeId: string;
  expiresInSeconds: number;
  resendInSeconds: number;
}

/** A proven code: the number it was sent to, still encrypted, and its blind index. */
export interface VerifiedMobile {
  mobile: EncryptedField;
  mobileIndex: string;
}

export interface OtpTarget {
  /** E.164, already validated as an Indian mobile number. */
  mobile: string;
  purpose: OtpPurpose;
  accountId: string | null;
  locale: Locale;
}

/** Device cookie and client address, used only for throttling (SE-08). */
export interface OtpOrigin {
  deviceId: string;
  address: string;
}

type Check = { kind: 'gone' } | { kind: 'wrong' } | { kind: 'ok'; row: OtpChallengeRow };

type Resend =
  { kind: 'gone' } | { kind: 'early'; waitSeconds: number } | { kind: 'ok'; row: OtpChallengeRow };

const TEMPLATES = { sign_in: 'otp_sign_in', reverify: 'otp_reverify' } as const;

/** Every expired, used-up or unknown challenge gives the same answer (no enumeration). */
const expired = () =>
  new BadRequestException({ error: 'Bad Request', message: 'Code expired', code: 'otp_expired' });

/**
 * One-time passwords by SMS (AC-01, SE-07, SE-08; decision L-6): issue, resend after a cooldown,
 * verify with an attempt limit. Codes are kept only as keyed hashes; network calls (KMS, SMS,
 * Redis) happen outside the database transaction.
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly challenges: OtpRepository,
    private readonly throttle: OtpThrottle,
    private readonly hasher: OtpHasher,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
    @Inject(BLIND_INDEXER) private readonly indexer: BlindIndexer,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  mobileIndex(mobile: string): string {
    return this.indexer.index('identity', mobile);
  }

  async issue(target: OtpTarget, origin: OtpOrigin): Promise<IssuedChallenge> {
    const mobileIndex = this.mobileIndex(target.mobile);
    await this.throttle.consumeSend({ mobileIndex, ...origin });
    const id = randomUUID();
    const code = newOtpCode();
    await this.challenges.create({
      id,
      purpose: target.purpose,
      mobile: await this.encryptor.encrypt(target.mobile, 'identity'),
      mobileIndex,
      accountId: target.accountId,
      codeHash: this.hasher.hash(id, code),
      ...windowsFromNow(),
    });
    await this.challenges.purgeExpired().catch(() => undefined);
    await this.deliver(target, code, id);
    return issued(id);
  }

  /** A new code for the same challenge, once the cooldown has passed (decision L-6). */
  async resend(challengeId: string, locale: Locale, origin: OtpOrigin): Promise<IssuedChallenge> {
    const code = newOtpCode();
    const outcome = await this.challenges.transaction(async (client): Promise<Resend> => {
      const row = await this.challenges.lock(client, challengeId);
      if (!row || !isOpen(row) || row.resends >= OTP_POLICY.maxResends) return { kind: 'gone' };
      const waitSeconds = Math.ceil((row.resend_at.getTime() - Date.now()) / 1000);
      if (waitSeconds > 0) return { kind: 'early', waitSeconds };
      const change = { codeHash: this.hasher.hash(row.id, code), ...windowsFromNow() };
      await this.challenges.replaceCode(client, row.id, change);
      return { kind: 'ok', row };
    });
    if (outcome.kind === 'gone') throw expired();
    if (outcome.kind === 'early') throw new OtpRateLimitedException(outcome.waitSeconds);
    await this.throttle.consumeSend({ mobileIndex: outcome.row.mobile_index, ...origin });
    const mobile = await this.encryptor.decrypt(outcome.row.mobile);
    const { purpose, account_id: accountId } = outcome.row;
    await this.deliver({ mobile, purpose, accountId, locale }, code, challengeId);
    return issued(challengeId);
  }

  /**
   * Checks a code. A wrong code counts against the challenge and the address; the fifth wrong code
   * ends the challenge. A right code is used once: a second request with it fails.
   */
  async verify(
    challengeId: string,
    code: string,
    expected: { purpose: OtpPurpose; accountId?: string },
    address: string,
  ): Promise<VerifiedMobile> {
    await this.throttle.assertVerifyAllowed(address);
    const outcome = await this.challenges.transaction(async (client): Promise<Check> => {
      const row = await this.challenges.lock(client, challengeId);
      if (!row || !isOpen(row) || !matchesExpected(row, expected)) return { kind: 'gone' };
      if (!this.hasher.matches(row.id, code, row.code_hash)) {
        await this.challenges.recordWrongCode(client, row.id);
        return { kind: 'wrong' };
      }
      await this.challenges.consume(client, row.id);
      return { kind: 'ok', row };
    });
    if (outcome.kind === 'gone') throw expired();
    if (outcome.kind === 'wrong') {
      await this.throttle.recordFailure(address);
      throw new BadRequestException({
        error: 'Bad Request',
        message: 'Incorrect code',
        code: 'otp_incorrect',
      });
    }
    return { mobile: outcome.row.mobile, mobileIndex: outcome.row.mobile_index };
  }

  /** Sends the code; if the SMS fails, the challenge is closed and the caller may retry. */
  private async deliver(target: OtpTarget, code: string, challengeId: string): Promise<void> {
    try {
      await this.sms.send({
        to: target.mobile,
        locale: target.locale,
        templateId: TEMPLATES[target.purpose],
        params: { code, minutes: String(OTP_POLICY.ttlSeconds / 60) },
      });
    } catch (error) {
      appLogger.warn({ event: 'otp_sms_failed', err: error }, 'OTP SMS not sent');
      await this.challenges
        .transaction((client) => this.challenges.consume(client, challengeId))
        .catch(() => undefined);
      throw new ServiceUnavailableException({
        error: 'Service Unavailable',
        message: 'SMS not sent',
        code: 'sms_unavailable',
      });
    }
  }
}

function windowsFromNow(): { expiresAt: Date; resendAt: Date } {
  const now = Date.now();
  return {
    expiresAt: new Date(now + OTP_POLICY.ttlSeconds * 1000),
    resendAt: new Date(now + OTP_POLICY.resendAfterSeconds * 1000),
  };
}

function issued(challengeId: string): IssuedChallenge {
  return {
    challengeId,
    expiresInSeconds: OTP_POLICY.ttlSeconds,
    resendInSeconds: OTP_POLICY.resendAfterSeconds,
  };
}

function isOpen(row: OtpChallengeRow): boolean {
  return (
    !row.consumed_at &&
    row.expires_at.getTime() > Date.now() &&
    row.attempts < OTP_POLICY.maxAttempts
  );
}

function matchesExpected(
  row: OtpChallengeRow,
  expected: { purpose: OtpPurpose; accountId?: string },
): boolean {
  return row.purpose === expected.purpose && (row.account_id ?? undefined) === expected.accountId;
}
