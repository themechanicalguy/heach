import { CATALOGUES, LOCALES, type Locale } from '@heach/i18n';
import { expect, type Page, test } from '@playwright/test';
import { expectAccessible } from './accessibility';
import { completeProviderSetup, confirmItIsMe, signInByOtp, syntheticMobile } from './otp-helpers';

/**
 * J1 in the browser, in Odia, English and Hindi: a nurse signs up, uploads every checklist
 * document, passes the identity check through the partner's test double, saves a payout account
 * after a fresh code, and submits for review. The admin suite then verifies an application (J5).
 * Needs the API, database and Mailpit: runs when E2E_API=1.
 */
const NURSE_DOCUMENTS = [
  { key: 'nursing_registration', reference: true, expiry: true },
  { key: 'qualification_certificate', reference: false, expiry: false },
  { key: 'police_verification', reference: true, expiry: true },
] as const;

const PDF = {
  name: 'certificate.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.7\n% synthetic certificate\n'),
};

async function uploadDocuments(page: Page, locale: Locale): Promise<void> {
  const t = CATALOGUES[locale];
  for (const document of NURSE_DOCUMENTS) {
    const card = page
      .locator('.heach-card')
      .filter({ has: page.getByRole('heading', { name: t.application.items[document.key] }) });
    await card.getByLabel(t.application.chooseFile).setInputFiles(PDF);
    if (document.reference) await card.getByLabel(t.application.reference).fill('SYN-12345');
    if (document.expiry) await card.getByLabel(t.application.expiresOn).fill('2030-01-01');
    await card.getByRole('button', { name: t.application.upload }).click();
    await expect(card.getByText(t.application.documentState.clean)).toBeVisible();
  }
}

async function payoutAndSubmit(page: Page, locale: Locale, mobile: string): Promise<void> {
  const t = CATALOGUES[locale];
  await page.getByRole('radio', { name: t.application.payoutMethod.upi }).check();
  await page.getByLabel(t.application.holderName).fill('Synthetic Nurse');
  await page.getByLabel(t.application.upiId).fill('synthetic@okbank');
  await page.getByRole('button', { name: t.application.savePayout }).click();
  await confirmItIsMe(page, locale, mobile);
  const submit = page.getByRole('button', { name: t.application.submit });
  await expect(submit).toBeEnabled({ timeout: 15_000 });
  await submit.click();
  await expect(page.getByText(t.application.statusText.submitted)).toBeVisible();
}

for (const locale of LOCALES) {
  test.describe(`Provider self-onboarding in the browser, in ${locale} (J1)`, () => {
    test.skip(!process.env.E2E_API, 'Needs the API, database and Mailpit (E2E_API=1)');
    test.describe.configure({ timeout: 120_000 });

    test(`J1 a nurse uploads documents, verifies identity, saves payout and submits, in ${locale}`, async ({
      page,
    }) => {
      const t = CATALOGUES[locale];
      const mobile = syntheticMobile();
      await signInByOtp(page, locale, mobile);
      await completeProviderSetup(page, 'nurse', 'Synthetic Onboarding Nurse', locale);
      await expect(page).toHaveURL(new RegExp(`/${locale}/provider$`));
      await expect(page.getByRole('heading', { name: t.application.title })).toBeVisible();
      await expectAccessible(page, 'provider application');
      await uploadDocuments(page, locale);
      await page.getByRole('button', { name: t.application.verifyIdentity }).click();
      // The partner sends the browser back through the identity return page to the application.
      await page.waitForURL(/\/provider\/onboarding\/identity/);
      await page.waitForURL(new RegExp(`/${locale}/provider$`));
      await expect(page.getByText(t.application.identityState.verified)).toBeVisible();
      await expect(page.getByRole('button', { name: t.application.savePayout })).toBeVisible();
      await payoutAndSubmit(page, locale, mobile);
    });
  });
}
