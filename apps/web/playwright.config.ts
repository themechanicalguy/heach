import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
// E2E_BASE_URL points the suite at a running stack (CI's deploy bundle behind Caddy);
// otherwise Playwright starts `next start` itself.
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${String(PORT)}`;

/** Mobile, tablet and desktop on every PR (TS-05.1); widths match the layout tokens (UX-02). */
export default defineConfig({
  testDir: './e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  // Visual baselines are Linux renders (CI, or the Playwright container locally).
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  use: { baseURL, ignoreHTTPSErrors: Boolean(process.env.E2E_BASE_URL) },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
        viewport: { width: 360, height: 800 },
      },
    },
    {
      name: 'tablet',
      use: { browserName: 'chromium', viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
  ],
  ...(!process.env.E2E_BASE_URL && {
    webServer: {
      command: `pnpm exec next start --port ${String(PORT)}`,
      url: `http://localhost:${String(PORT)}/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { APP_ENV: 'test', FEATURE_FLAGS: 'sample-patient-note' },
    },
  }),
});
