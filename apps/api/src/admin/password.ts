import { randomBytes, scrypt, type ScryptOptions, timingSafeEqual } from 'node:crypto';

const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const KEY_LENGTH = 32;
export const MIN_PASSWORD_LENGTH = 12;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** Salted scrypt hash of an admin password (decision L-9), as `scrypt$N$r$p$salt$hash`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')]
    .map(String)
    .join('$');
}

/** Constant-time check; a malformed hash never matches. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const options = { N: Number(n), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem };
  const actual = await derive(password, Buffer.from(salt, 'base64'), options);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Checked against when the email is unknown, so an unknown and a known address take the same time
 * (no enumeration). Its password is random and thrown away.
 */
export const DUMMY_HASH_PROMISE: Promise<string> = hashPassword(randomBytes(24).toString('hex'));
