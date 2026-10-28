import { base32Decode, base32Encode, matchTotp, otpauthUri, stepAt, totpAt } from './totp.js';

// RFC 6238 appendix B test secret ("12345678901234567890", SHA-1).
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP (AD-01, L-9)', () => {
  it('AD-01 matches the RFC 6238 SHA-1 test vectors (six digits)', () => {
    expect(totpAt(RFC_SECRET, stepAt(59_000))).toBe('287082');
    expect(totpAt(RFC_SECRET, stepAt(1_111_111_109_000))).toBe('081804');
    expect(totpAt(RFC_SECRET, stepAt(20_000_000_000_000))).toBe('353130');
  });

  it('AD-01 base32 round-trips', () => {
    const bytes = Buffer.from([0, 1, 2, 250, 255, 128, 7]);
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true);
    expect(() => base32Decode('not base32!')).toThrow();
  });

  it('AD-01 accepts one step of drift and never the same step twice', () => {
    const now = 1_700_000_000_000;
    const step = stepAt(now);
    expect(matchTotp(RFC_SECRET, totpAt(RFC_SECRET, step), now, null)).toBe(step);
    expect(matchTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 1), now, null)).toBe(step - 1);
    expect(matchTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 2), now, null)).toBeUndefined();
    expect(matchTotp(RFC_SECRET, totpAt(RFC_SECRET, step), now, step)).toBeUndefined();
  });

  it('AD-01 the enrolment link names the issuer and the account', () => {
    expect(otpauthUri('ABC', 'a@example.test')).toBe(
      'otpauth://totp/HEACH%20Admin%3Aa%40example.test?secret=ABC&issuer=HEACH%20Admin&period=30&digits=6',
    );
  });
});
