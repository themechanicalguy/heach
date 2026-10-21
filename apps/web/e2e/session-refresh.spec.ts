import { CATALOGUES } from '@heach/i18n';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';

const or = CATALOGUES.or;

async function signIn(page: Page) {
  await page.goto('/or/sign-in');
  await page.getByRole('button', { name: or.auth.test.patientA }).click();
  await expect(page).toHaveURL(/\/or\/notes$/);
  await expect(page.getByLabel(or.sample.note.label)).toBeVisible();
}

/** The first notes call of the page answers 401, as when its access token has expired. */
async function expireFirstNotesCall(page: Page) {
  let expired = false;
  await page.route('**/api/v1/sample/notes', async (route) => {
    if (expired) return route.continue();
    expired = true;
    return route.fulfill({ status: 401 });
  });
}

const notesLoaded = (page: Page) =>
  Promise.all([
    expect(page.getByLabel(or.sample.note.label)).toBeVisible(),
    expect(page.getByRole('status').filter({ hasText: or.state.loading })).toHaveCount(0),
    expect(page.getByText(or.state.error)).toHaveCount(0),
  ]);

/** The browser's refresh cookie still works, so nothing revoked the user's sessions. */
async function sessionStillValid(context: BrowserContext) {
  const response = await context.request.post('/api/v1/auth/refresh');
  expect(response.status()).toBe(200);
}

/**
 * Session-refresh reliability (spec 001) through Caddy, web, API, PostgreSQL and Redis.
 * Needs the API: runs when E2E_API=1 (CI runs it against the deploy bundle).
 */
test.describe('Session refresh across calls and tabs', () => {
  test.skip(!process.env.E2E_API, 'Needs the API and database (E2E_API=1)');

  test('SE-07.5 SE-07.7 parallel expired calls in two tabs keep the session', async ({
    context,
  }) => {
    const first = await context.newPage();
    await signIn(first);
    const second = await context.newPage();
    await Promise.all([expireFirstNotesCall(first), expireFirstNotesCall(second)]);
    // Both tabs restore the session and meet an expired token at the same time.
    await Promise.all([first.reload(), second.goto('/or/notes')]);
    await Promise.all([notesLoaded(first), notesLoaded(second)]);
    await sessionStillValid(context);
  });

  test('SE-07.12 signing out in one tab signs out the other', async ({ context }) => {
    const first = await context.newPage();
    await signIn(first);
    const second = await context.newPage();
    await second.goto('/or/notes');
    await notesLoaded(second);
    await first.goto('/or/sign-in');
    await first.getByRole('button', { name: or.auth.signOut }).click();
    await expect(second.getByRole('link', { name: or.auth.test.title })).toBeVisible({
      timeout: 2000,
    });
    const refresh = await context.request.post('/api/v1/auth/refresh');
    expect(refresh.status()).toBe(401);
  });
});
