import { expect, test } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };
import { createAdmin, signIn } from './admin-helpers';

/**
 * J5 in the browser: a verifier opens the oldest waiting application, accepts each document and
 * approves the provider (AD-02). Runs after the web suite, whose J1 journeys submit applications;
 * needs the API with the `accounts` flag: E2E_API=1.
 */
test.describe('Admin verifies a provider (J5)', () => {
  test.skip(!process.env.E2E_API, 'Needs the API and database (E2E_API=1)');

  test('J5 a verifier reviews documents side by side and approves the provider', async ({
    page,
  }) => {
    await signIn(page, createAdmin('verifier'));
    await page.getByRole('button', { name: en.nav.verification }).click();
    await page
      .getByRole('button', { name: new RegExp(`^${en.verification.open}`) })
      .first()
      .click();
    const panel = page.getByRole('complementary', { name: en.verification.detailTitle });
    await expect(panel.getByText(en.verification.documents)).toBeVisible();
    const accept = panel.getByRole('button', { name: en.verification.accept, exact: true });
    const documents = await accept.count();
    expect(documents).toBeGreaterThan(0);
    for (let index = 0; index < documents; index += 1) {
      const saved = page.waitForResponse(
        (response) =>
          response.url().includes('/documents') && response.request().method() === 'POST',
      );
      await accept.nth(index).click();
      expect((await saved).ok()).toBe(true);
    }
    await panel.getByRole('button', { name: en.verification.approve, exact: true }).click();
    await expect(panel.getByText(en.verification.decided)).toBeVisible();
  });
});
