import { newOtpCode, OtpHasher } from './otp-code.js';

const hasher = new OtpHasher(Buffer.alloc(32, 7));

describe('OTP codes (L-6)', () => {
  it('SE-08 codes are six digits, zero-padded', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(newOtpCode()).toMatch(/^\d{6}$/);
    }
  });

  it('SE-08 only a keyed hash bound to the challenge is kept', () => {
    const hash = hasher.hash('challenge-1', '123456');
    expect(hash).not.toContain('123456');
    expect(hasher.matches('challenge-1', '123456', hash)).toBe(true);
    expect(hasher.matches('challenge-1', '123457', hash)).toBe(false);
    expect(hasher.matches('challenge-2', '123456', hash)).toBe(false);
    expect(hasher.matches('challenge-1', '123456', 'not-hex')).toBe(false);
  });

  it('SE-08 another root key gives other hashes', () => {
    const other = new OtpHasher(Buffer.alloc(32, 8));
    expect(other.hash('c', '000000')).not.toBe(hasher.hash('c', '000000'));
  });
});
