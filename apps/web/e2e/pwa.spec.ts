import { CATALOGUES } from '@heach/i18n';
import { expect, test } from '@playwright/test';

test.describe('PWA (PF-07.1, EN-11)', () => {
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    'Service workers need a trusted origin; runs against next start',
  );

  test('PF-07.1 installs, shows the shell offline with the banner, and caches no API response', async ({
    page,
    context,
  }) => {
    const manifest = (await (await page.request.get('/manifest.webmanifest')).json()) as {
      display: string;
      start_url: string;
      icons: { sizes: string }[];
    };
    expect(manifest).toMatchObject({ display: 'standalone', start_url: '/' });
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    );

    await page.goto('/en');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload(); // now controlled by the service worker
    await page.request.post('/api/v1/auth/refresh').catch(() => undefined);
    await page.evaluate(() =>
      fetch('/api/v1/auth/refresh', { method: 'POST' }).catch(() => undefined),
    );

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(CATALOGUES.en.home.title);
    await expect(page.getByText(CATALOGUES.en.offline.banner)).toBeVisible();

    const cachedUrls = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        for (const request of await (await caches.open(name)).keys())
          urls.push(new URL(request.url).pathname);
      }
      return urls;
    });
    expect(cachedUrls.length).toBeGreaterThan(0);
    expect(cachedUrls.filter((url) => url.startsWith('/api/'))).toEqual([]);
    await context.setOffline(false);
  });
});
