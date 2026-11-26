import { type Browser, type BrowserContext, test as base } from '@playwright/test';

export { expect } from '@playwright/test';
export type { BrowserContext, Page } from '@playwright/test';

/** The flag LocationDialog sets once a tab has been asked where care is needed (SD-04). */
const LOCATION_ASKED_KEY = 'heach:location-asked';

/**
 * Journeys start as a visitor who has already answered the location question, so the sheet that
 * opens on landing pages does not cover the page under test.
 */
async function skipLocationQuestion(context: BrowserContext): Promise<void> {
  await context.addInitScript((key) => {
    try {
      sessionStorage.setItem(key, '1');
    } catch {
      // A page without storage shows the question; the test then sees it as a visitor would.
    }
  }, LOCATION_ASKED_KEY);
}

/** A second browser context (another device or person) with the same starting state. */
export async function newContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext();
  await skipLocationQuestion(context);
  return context;
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await skipLocationQuestion(context);
    await use(context);
  },
});
