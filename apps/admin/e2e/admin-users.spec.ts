import { execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };

const PASSWORD = 'synthetic-admin-password';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 6238 code for a base32 secret at a time step (the test plays the authenticator app). */
function totp(secret: string, step = Math.floor(Date.now() / 30_000)): string {
  const bits = Array.from(secret, (c) => ALPHABET.indexOf(c).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = (digest.at(-1) ?? 0) & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/** A synthetic admin through the real CLI (password on standard input). */
function createAdmin(role: string): string {
  const email = `${role}-${randomUUID()}@heach.invalid`;
  const cli = ['--env-file-if-exists=../../.env', 'dist/jobs/create-admin.js'];
  execFileSync(process.execPath, [...cli, '--email', email, '--role', role], {
    input: PASSWORD,
    cwd: '../api',
    stdio: ['pipe', 'ignore', 'inherit'],
  });
  return email;
}

async function signIn(page: Page, email: string): Promise<string> {
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

/**
 * Admin sign-in with TOTP enrolment, masked users, and suspension behind a fresh code (AD-01,
 * AD-03). Needs the API with the `accounts` flag and at least one OTP account: E2E_API=1.
 */
test.describe('Admin users', () => {
  test.skip(!process.env.E2E_API, 'Needs the API and database (E2E_API=1)');

  test('AD-03 support signs in with TOTP, opens a masked user and suspends then reinstates', async ({
    page,
  }) => {
    const secret = await signIn(page, createAdmin('support'));
    await page.getByRole('button', { name: en.nav.users }).click();
    await expect(page.getByRole('table', { name: en.users.caption })).toBeVisible();
    await expect(page.getByRole('cell', { name: /^••••••\d{4}$/ }).first()).toBeVisible();
    await page
      .getByRole('button', { name: new RegExp(`^${en.users.open}`) })
      .first()
      .click();
    const panel = page.getByRole('complementary', { name: en.users.detailTitle });
    // Start from whatever state the user is in; end in the same state.
    const action = panel.getByRole('button', { name: /^(Suspend|Reinstate)$/ });
    const suspendFirst = (await action.textContent()) === en.users.suspend;
    const [first, second] = suspendFirst
      ? [en.users.suspended, en.users.reinstated]
      : [en.users.reinstated, en.users.suspended];
    await action.click();
    const sheet = page.getByRole('dialog', { name: en.reverify.title });
    await sheet.getByLabel(en.signIn.code).fill(totp(secret, Math.floor(Date.now() / 30_000) + 1));
    await sheet.getByRole('button', { name: en.reverify.confirm }).click();
    await expect(panel.getByText(first)).toBeVisible();
    await action.click();
    await expect(panel.getByText(second)).toBeVisible();
  });

  test('AD-01 finance has no user management', async ({ page }) => {
    await signIn(page, createAdmin('finance'));
    await expect(page.getByRole('button', { name: en.nav.users })).toHaveCount(0);
  });
});
