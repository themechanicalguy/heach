import {
  DUMMY_HASH_PROMISE,
  hashPassword,
  MAX_PASSWORD_LENGTH,
  newPasswordProblem,
  newTemporaryPassword,
  verifyPassword,
} from './password.js';

describe('Admin passwords (AD-01, L-9)', () => {
  it('AD-01 stores a salted scrypt hash, never the password', async () => {
    const hash = await hashPassword('synthetic-password-1');
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(hash).not.toContain('synthetic-password-1');
    expect(await hashPassword('synthetic-password-1')).not.toBe(hash);
  });

  it('AD-01 verifies the right password only', async () => {
    const hash = await hashPassword('synthetic-password-1');
    expect(await verifyPassword('synthetic-password-1', hash)).toBe(true);
    expect(await verifyPassword('synthetic-password-2', hash)).toBe(false);
    expect(await verifyPassword('synthetic-password-1', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('anything', await DUMMY_HASH_PROMISE)).toBe(false);
  });

  it('O-2 a temporary password is long and random; new passwords have bounds', () => {
    const first = newTemporaryPassword();
    expect(first).toMatch(/^[\w-]{24}$/);
    expect(newTemporaryPassword()).not.toBe(first);
    expect(newPasswordProblem('short')).toBe('password_too_short');
    expect(newPasswordProblem('x'.repeat(MAX_PASSWORD_LENGTH + 1))).toBe('password_too_long');
    expect(newPasswordProblem('a long synthetic passphrase')).toBeUndefined();
  });
});
