import { createHmac, randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const TOTP_PERIOD_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(bytes: Buffer): string {
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  const chunks = bits.match(/.{1,5}/g) ?? [];
  return chunks.map((chunk) => ALPHABET[parseInt(chunk.padEnd(5, '0'), 2)]).join('');
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=]/g, '').toUpperCase();
  let bits = '';
  for (const char of clean) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) throw new Error('Not base32');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((byte) => parseInt(byte, 2)));
}

/** A new 160-bit shared secret, base32 as authenticator apps expect (RFC 6238). */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** HOTP (RFC 4226) for one time step. */
export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function stepAt(timeMs: number): number {
  return Math.floor(timeMs / 1000 / TOTP_PERIOD_SECONDS);
}

/**
 * The time step a code belongs to, allowing one step of clock drift either way, or undefined.
 * A step at or before `lastUsedStep` never matches, so a code works once (decision L-9).
 */
export function matchTotp(
  secret: string,
  code: string,
  timeMs: number,
  lastUsedStep: number | null,
): number | undefined {
  const now = stepAt(timeMs);
  return [now - 1, now, now + 1].find(
    (step) => (lastUsedStep === null || step > lastUsedStep) && totpAt(secret, step) === code,
  );
}

/** The link authenticator apps read; shown once, at enrolment, to the admin themself. */
export function otpauthUri(secret: string, email: string): string {
  const label = encodeURIComponent(`HEACH Admin:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('HEACH Admin')}&period=${String(TOTP_PERIOD_SECONDS)}&digits=${String(DIGITS)}`;
}
