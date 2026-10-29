import { createHmac, hkdfSync, randomInt, timingSafeEqual } from 'node:crypto';

export const OTP_LENGTH = 6;

/** How long a code works, when it may be resent, and how many tries it allows (decision L-6). */
export const OTP_POLICY = {
  ttlSeconds: 5 * 60,
  resendAfterSeconds: 30,
  maxAttempts: 5,
  maxResends: 3,
} as const;

/** A uniformly random six-digit code. */
export function newOtpCode(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

/**
 * Keyed hash of a code, bound to its challenge so a hash cannot be replayed on another one. The
 * key is derived from the blind-index root key with its own label, so no new secret is needed.
 */
export class OtpHasher {
  private readonly key: Buffer;

  constructor(rootKey: Buffer) {
    this.key = Buffer.from(hkdfSync('sha256', rootKey, 'heach-otp', 'otp-code', 32));
  }

  hash(challengeId: string, code: string): string {
    return createHmac('sha256', this.key).update(`${challengeId}:${code}`).digest('hex');
  }

  matches(challengeId: string, code: string, storedHash: string): boolean {
    const expected = Buffer.from(this.hash(challengeId, code), 'hex');
    const stored = Buffer.from(storedHash, 'hex');
    return expected.length === stored.length && timingSafeEqual(expected, stored);
  }
}
