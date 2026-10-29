import { expect, test } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };

test('AD-01 without a session the admin app shows only sign-in', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: en.signIn.title })).toBeVisible();
  await expect(page.getByLabel(en.signIn.password)).toBeVisible();
  await expect(page.getByRole('navigation', { name: en.app.navLabel })).toHaveCount(0);
});

test('sign-in page has no horizontal scroll at tablet width', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: en.signIn.title })).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});
