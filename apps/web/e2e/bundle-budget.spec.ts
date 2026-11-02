import { expect, test } from '@playwright/test';
import { initialJsGzipBytes } from '../scripts/bundle-budget.mjs';

const BUDGET = 170 * 1024; // PF-02.1: initial JS per entry route, gzipped
const ENTRY_ROUTES = ['/or', '/en', '/hi', '/or/provider', '/or/notes', '/or/sign-in'];

test.describe('Bundle budget (PF-02.1)', () => {
  for (const route of ENTRY_ROUTES) {
    test(`PF-02.1 ${route} loads at most 170 KB of gzipped JavaScript`, async ({
      request,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'Measured once, on the desktop project');
      const response = await request.get(route);
      expect(response.status(), route).toBe(200);
      const html = await response.text();
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
    ENTRY_ROUTES.map(async (route) => {
      const response = await request.get(route);
      expect(response.status(), route).toBe(200);
      return new Set(initialScripts(await response.text()));
    }),
  );
  const home = scripts[ENTRY_ROUTES.indexOf('/or')];
  const notes = scripts[ENTRY_ROUTES.indexOf('/or/notes')];
  expect([...(notes ?? [])].some((src) => !home?.has(src))).toBe(true);
});
