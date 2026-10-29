import { expect, test } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };
import { createAdmin, signIn, totp } from './admin-helpers';

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
