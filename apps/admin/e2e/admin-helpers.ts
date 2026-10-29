import { execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };

export const PASSWORD = 'synthetic-admin-password';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 6238 code for a base32 secret at a time step (the test plays the authenticator app). */
export function totp(secret: string, step = Math.floor(Date.now() / 30_000)): string {
  const bits = Array.from(secret, (c) => ALPHABET.indexOf(c).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = (digest.at(-1) ?? 0) & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/** A synthetic admin through the real CLI (password on standard input). */
export function createAdmin(role: string): string {
  const email = `${role}-${randomUUID()}@heach.invalid`;
  const cli = ['--env-file-if-exists=../../.env', 'dist/jobs/create-admin.js'];
  execFileSync(process.execPath, [...cli, '--email', email, '--role', role], {
    input: PASSWORD,
    cwd: '../api',
    stdio: ['pipe', 'ignore', 'inherit'],
  });
  return email;
}

export async function signIn(page: Page, email: string): Promise<string> {
  await page.goto('/');
  await page.getByLabel(en.signIn.email).fill(email);
  await page.getByLabel(en.signIn.password).fill(PASSWORD);
  await page.getByRole('button', { name: en.signIn.continue }).click();
  await expect(page.getByRole('heading', { name: en.signIn.enrolTitle })).toBeVisible();
  const secret = (await page.locator('.admin-secret').textContent()) ?? '';
  await page.getByLabel(en.signIn.code).fill(totp(secret));
  await page.getByRole('button', { name: en.signIn.verify }).click();
  await expect(page.getByRole('navigation', { name: en.app.navLabel })).toBeVisible();
  return secret;
}
