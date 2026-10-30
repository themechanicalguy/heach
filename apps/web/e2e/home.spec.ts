import { CATALOGUES, LOCALES } from '@heach/i18n';
import { expect, test } from '@playwright/test';

for (const locale of LOCALES) {
  test(`I18N-01.1 /${locale} serves the shell in its language without horizontal scroll`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);

    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(CATALOGUES[locale].home.title);
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });
}

test.describe('with a Hindi browser', () => {
  test.use({ locale: 'hi-IN' });

  test('I18N-01.1 / redirects to the browser language', async ({ page }) => {
    await page.goto('/');
    // With the accounts flag on, the first visit lands on the language choice (AC-02).
    await expect(page).toHaveURL(/\/hi(\/welcome)?$/);
  });
});

test('SO-05.1 pages carry a nonce CSP without unsafe-inline scripts', async ({ request }) => {
  const response = await request.get('/en');
  const csp = response.headers()['content-security-policy'] ?? '';
  expect(csp).toMatch(/script-src 'self' 'nonce-[\w+/=]+' 'strict-dynamic'/);
  expect(csp).not.toContain('unsafe-inline');
});

test('/healthz reports status and version', async ({ request }) => {
  const response = await request.get('/healthz');

  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: 'ok', version: expect.any(String) });
});
