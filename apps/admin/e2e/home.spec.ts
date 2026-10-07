import { expect, test } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };

test('landing page shows sidebar beside content at 1280 px', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.dashboard.title);
  await expect(page.getByRole('button', { name: en.dashboard.refresh })).toBeVisible();

  const sidebar = await page.locator('aside').boundingBox();
  const main = await page.getByRole('main').boundingBox();
  expect(sidebar && main && sidebar.x + sidebar.width <= main.x).toBe(true);
});

test('landing page has no horizontal scroll at tablet width', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});
