import { CATALOGUES } from '@heach/i18n';
import { expect, type Page, test } from '@playwright/test';

const or = CATALOGUES.or;
const NOTE = `ଆଜି ମୋର ମୁଣ୍ଡ ବିନ୍ଧୁଛି ${String(Date.now())}`; // synthetic, unique per run

async function signIn(page: Page, who: 'patientA' | 'patientB') {
  await page.goto('/or/sign-in');
  await page.getByRole('button', { name: or.auth.test[who] }).click();
  await expect(page).toHaveURL(/\/or\/notes$/);
}

/**
 * The Step 2 exit flow (EN-13.1, SE-02.3, I18N-04.1, LM-01.1): an Odia note written by patient A
 * is shown back unchanged, carries a correlation ID on every API call, and patient B cannot see it.
 * Needs the API: runs when E2E_API=1 (CI runs it against the deploy bundle behind Caddy).
 */
test.describe('Encrypted, owner-only Odia note', () => {
  test.skip(!process.env.E2E_API, 'Needs the API and database (E2E_API=1)');
  test.describe.configure({ mode: 'serial' });

  test('EN-13.1 I18N-04.1 LM-01.1 patient A writes and reads an Odia note', async ({ page }) => {
    const correlationIds: string[] = [];
    page.on('request', (request) => {
      // App API calls; RUM beacons carry no identity and no correlation ID.
      if (request.url().includes('/api/v1/') && request.resourceType() === 'fetch') {
        correlationIds.push(request.headers()['x-correlation-id'] ?? '');
      }
    });
    await signIn(page, 'patientA');
    await page.getByLabel(or.sample.note.label).fill(NOTE);
    await page.getByRole('button', { name: or.sample.note.save }).click();
    await expect(page.getByRole('status').filter({ hasText: or.sample.note.saved })).toBeVisible();
    await expect(page.getByText(NOTE)).toBeVisible();
    expect(correlationIds.length).toBeGreaterThan(2);
    expect(correlationIds.every((id) => /^[0-9a-f-]{36}$/.test(id))).toBe(true);
  });

  test("SE-02.3 EN-13.1 patient B does not see patient A's note", async ({ page }) => {
    await signIn(page, 'patientB');
    await expect(page.getByLabel(or.sample.note.label)).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: or.state.loading })).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(NOTE);
  });
});
