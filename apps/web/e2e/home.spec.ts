import { expect, test } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };

test('home page renders the heading at 360 px without horizontal scroll', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.home.title);
  await expect(page.getByRole('button', { name: en.home.findCare })).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});

test('/healthz reports status and version', async ({ request }) => {
  const response = await request.get('/healthz');

  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: 'ok', version: expect.any(String) });
});
