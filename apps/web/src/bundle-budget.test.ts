// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { initialJsGzipBytes, initialScripts } from '../scripts/bundle-budget.mjs';

const BUDGET = 170 * 1024;

describe('bundle budget measurement (PF-02.1)', () => {
  const html = `<html><head>
    <link rel="preload" as="script" href="/_next/static/chunks/a.js" />
    <script src="/_next/static/chunks/a.js" async></script>
    <script src="/_next/static/chunks/b.js"></script>
    <script src="https://cdn.example/x.js"></script>
    <script src="/_next/static/chunks/polyfills.js" noModule=""></script>
  </head></html>`;

  it('counts each same-origin module script once, not legacy nomodule polyfills', () => {
    expect(initialScripts(html)).toEqual([
      '/_next/static/chunks/a.js',
      '/_next/static/chunks/b.js',
    ]);
  });

  it('PF-02.1 fixture: a route over 170 KB gzipped is over budget', async () => {
    // Random bytes do not compress, so 200 KB stays about 200 KB gzipped.
    const bytes = await initialJsGzipBytes(html, () => Promise.resolve(randomBytes(100 * 1024)));
    expect(bytes).toBeGreaterThan(BUDGET);
  });

  it('a small route is within budget', async () => {
    const bytes = await initialJsGzipBytes(html, () =>
      Promise.resolve(Buffer.from('console.log(1)')),
    );
    expect(bytes).toBeLessThan(BUDGET);
  });
});
