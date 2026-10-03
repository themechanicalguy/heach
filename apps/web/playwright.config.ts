import { defineConfig } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: `http://localhost:${String(PORT)}` },
  projects: [
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `pnpm exec next start --port ${String(PORT)}`,
    url: `http://localhost:${String(PORT)}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
