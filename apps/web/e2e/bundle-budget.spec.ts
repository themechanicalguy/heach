import { expect, test } from '@playwright/test';
import { initialJsGzipBytes } from '../scripts/bundle-budget.mjs';

const BUDGET = 170 * 1024; // PF-02.1: initial JS per entry route, gzipped
const ENTRY_ROUTES = ['/or', '/or/notes', '/or/sign-in'];

test.describe('Bundle budget (PF-02.1)', () => {
  for (const route of ENTRY_ROUTES) {
    test(`PF-02.1 ${route} loads at most 170 KB of gzipped JavaScript`, async ({
      request,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'Measured once, on the desktop project');
      const html = await (await request.get(route)).text();
      const bytes = await initialJsGzipBytes(html, async (src) =>
        Buffer.from(await (await request.get(src)).body()),
      );
      testInfo.annotations.push({ type: 'gzip bytes', description: String(bytes) });
      expect(bytes).toBeLessThanOrEqual(BUDGET);
    });
  }
});

test('PF-05.1 routes are split: each entry route loads code the others do not', async ({
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Checked once, on the desktop project');
  const { initialScripts } = await import('../scripts/bundle-budget.mjs');
  const scripts = await Promise.all(
    ENTRY_ROUTES.map(
      async (route) => new Set(initialScripts(await (await request.get(route)).text())),
    ),
  );
  const [home, notes] = scripts;
  expect([...(notes ?? [])].some((src) => !home?.has(src))).toBe(true);
});
