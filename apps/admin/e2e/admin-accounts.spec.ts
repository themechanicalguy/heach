import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };
import { createAdmin, signIn, totp } from './admin-helpers';

const NEW_PASSWORD = 'a-new-synthetic-passphrase';
const nextStep = () => Math.floor(Date.now() / 30_000) + 1;

/** Answers the fresh-TOTP sheet with the next step's code (decision L-11). */
async function confirmWithCode(page: Page, secret: string): Promise<void> {
  const sheet = page.getByRole('dialog', { name: en.reverify.title });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel(en.signIn.code).fill(totp(secret, nextStep()));
  await sheet.getByRole('button', { name: en.reverify.confirm }).click();
}

/**
 * Admin accounts managed by a super admin (AD-01, owner decision O-2): create an admin with a
 * temporary password, whose first sign-in enrols TOTP and sets a new password; sub-roles see only
 * their sections. Runs on the desktop and tablet projects. Needs the API: E2E_API=1.
 */
test.describe('Admin accounts', () => {
  test.skip(!process.env.E2E_API, 'Needs the API and database (E2E_API=1)');

  test('O-2 a super admin creates a verifier, who must replace the temporary password', async ({
    browser,
  }) => {
    const admin = await (await browser.newContext()).newPage();
    const secret = await signIn(admin, createAdmin('super_admin'));
    await admin.getByRole('button', { name: en.nav.admins }).click();
    await expect(admin.getByRole('table', { name: en.admins.caption })).toBeVisible();
    await expect(admin.getByRole('cell', { name: en.admins.you })).toBeVisible();

    const email = `verifier-${randomUUID()}@heach.invalid`;
    await admin.getByLabel(en.admins.email).fill(email);
    await admin.getByLabel(en.admins.role).first().selectOption('verifier');
    await admin.getByRole('button', { name: en.admins.create }).click();
    await confirmWithCode(admin, secret);
    const shown = admin.getByText(en.admins.temporaryShown).locator('.admin-secret');
    const temporary = (await shown.textContent()) ?? '';
    expect(temporary).toMatch(/^[\w-]{24}$/);
    await expect(admin.getByRole('cell', { name: email })).toBeVisible();

    const verifier = await (await browser.newContext()).newPage();
    await verifier.goto('/');
    await verifier.getByLabel(en.signIn.email).fill(email);
    await verifier.getByLabel(en.signIn.password).fill(temporary);
    await verifier.getByRole('button', { name: en.signIn.continue }).click();
    await expect(verifier.getByRole('heading', { name: en.password.temporaryTitle })).toBeVisible();
    const verifierSecret = (await verifier.locator('.admin-secret').textContent()) ?? '';
    await verifier.getByLabel(en.password.new, { exact: true }).fill(NEW_PASSWORD);
    await verifier.getByLabel(en.password.repeat).fill(NEW_PASSWORD);
    await verifier.getByLabel(en.signIn.code).fill(totp(verifierSecret));
    await verifier.getByRole('button', { name: en.signIn.verify }).click();
    await expect(verifier.getByRole('navigation', { name: en.app.navLabel })).toBeVisible();
    await expect(verifier.getByRole('button', { name: en.nav.admins })).toHaveCount(0);
    await expect(verifier.getByRole('button', { name: en.nav.users })).toBeVisible();
  });

  test('O-2 an admin changes their own password after a fresh code', async ({ page }) => {
    const secret = await signIn(page, createAdmin('finance'));
    await expect(page.getByRole('button', { name: en.nav.admins })).toHaveCount(0);
    await page.getByRole('button', { name: en.nav.password }).click();
    await page.getByLabel(en.password.current).fill('synthetic-admin-password');
    await page.getByLabel(en.password.new, { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel(en.password.repeat).fill('something else');
    await expect(page.getByText(en.password.mismatch)).toBeVisible();
    await page.getByLabel(en.password.repeat).fill(NEW_PASSWORD);
    await page.getByRole('button', { name: en.password.change }).click();
    await confirmWithCode(page, secret);
    await expect(page.getByText(en.password.changed)).toBeVisible();
  });
});
