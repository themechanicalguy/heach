import { expect, type Page, test } from '@playwright/test';
import en from '../messages/en.json' with { type: 'json' };
import { expectAccessible } from './accessibility';

/**
 * G17–G19 with a synthetic API: the compact queue, the review panel with its decision in reach,
 * and the focused document review. No real data; nothing is sent anywhere.
 */
const ACCOUNT = '00000000-0000-4000-8000-0000000000b1';
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const checklistDoc = (id: string, key: string) => ({
  key,
  required: true,
  reference: true,
  expiry: false,
  document: {
    id,
    scanStatus: 'clean',
    reference: 'SYN-1',
    expiresOn: null,
    reviewStatus: 'pending',
    reviewReason: null,
    uploadedAt: '2026-10-30T00:00:00Z',
  },
});
const application = {
  accountId: ACCOUNT,
  fullName: 'Synthetic Nurse',
  role: 'nurse',
  status: 'under_review',
  statusReason: null,
  identity: 'verified',
  needsPayout: true,
  payout: { method: 'upi', holderName: 'Synthetic Nurse', hint: '3210' },
  editable: false,
  missing: [],
  items: [
    checklistDoc('00000000-0000-4000-8000-0000000000d1', 'nursing_registration'),
    checklistDoc('00000000-0000-4000-8000-0000000000d2', 'police_verification'),
  ],
  history: [],
};
const queue = [
  {
    accountId: ACCOUNT,
    fullName: 'Synthetic Nurse',
    role: 'nurse',
    status: 'under_review',
    submittedAt: new Date(Date.now() - 5 * 864e5).toISOString(),
    identity: 'verified',
  },
];

async function syntheticAdmin(page: Page, searches: string[]) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/admin/v1', '');
    const respond = (json: unknown) => route.fulfill({ json });
    if (path === '/auth/refresh') return respond({ accessToken: 'synthetic-admin' });
    if (path === '/me')
      return respond({ id: 'a1', email: 'verifier@heach.invalid', role: 'verifier' });
    if (path === '/applications/search') {
      searches.push(route.request().postData() ?? '');
      return respond(queue);
    }
    if (path.includes('/documents/'))
      return respond({ contentType: 'image/png', contentBase64: PNG });
    if (path.startsWith('/applications/')) return respond(application);
    if (path === '/dashboard')
      return respond({
        signUps: 0,
        completionRate: 0,
        cancellationRate: 0,
        revenuePaise: 0,
        providersByRole: [],
        providersByDistrict: [],
        bookingsByService: [],
        bookingsByStatus: [],
      });
    return respond([]);
  });
}

test('G17–G19 compact queue, reachable decision and focused document review', async ({
  page,
}, testInfo) => {
  const searches: string[] = [];
  await syntheticAdmin(page, searches);
  await page.goto('/');
  await page.getByRole('button', { name: en.nav.verification }).click();
  const row = page.getByRole('row').filter({ hasText: 'Synthetic Nurse' });
  await expect(row).toContainText(en.checklists.roles.nurse);
  await expect(row).toContainText(en.verification.identityStates.verified);
  await expect(row).toContainText('5 days');
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain(
    'Anek Latin',
  );
  await page.getByRole('searchbox').fill('Synthetic');
  await page.keyboard.press('Enter');
  await expect.poll(() => searches.at(-1)).toContain('"q":"Synthetic"');
  expect(page.url()).not.toContain('Synthetic');
  await expectAccessible(page, 'verification queue');
  await page.getByRole('button', { name: `${en.verification.open} Synthetic Nurse` }).click();
  const panel = page.getByRole('complementary', { name: en.verification.detailTitle });
  await expect(
    panel.getByText(en.checklists.items.police_verification, { exact: true }),
  ).toBeVisible();
  await expect(panel.getByText('police_verification', { exact: true })).toHaveCount(0);
  const approve = panel.getByRole('button', { name: en.verification.approve });
  if (testInfo.project.name === 'desktop') await expect(approve).toBeInViewport();
  await expect(panel.getByRole('button', { name: en.verification.requestChanges })).toBeDisabled();
  await expectAccessible(page, 'review panel');
  await panel.getByRole('button', { name: en.verification.reviewDocuments }).click();
  await expect(
    page.getByRole('img', { name: en.checklists.items.nursing_registration }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: new RegExp(en.checklists.items.police_verification) })
    .click();
  await expect(
    page.getByRole('img', { name: en.checklists.items.police_verification }),
  ).toBeVisible();
  if (testInfo.project.name === 'desktop')
    await expect(page.getByRole('button', { name: en.verification.approve })).toBeInViewport();
  await expectAccessible(page, 'document review');
  await page.getByRole('button', { name: en.verification.backToQueue }).click();
  await expect(row).toBeVisible();
});
