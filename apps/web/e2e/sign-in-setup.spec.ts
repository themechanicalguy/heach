import { CATALOGUES, LOCALES } from '@heach/i18n';
import { expect, test } from '@playwright/test';
import {
  codeFor,
  completePatientSetup,
  inboxOf,
  signInByOtp,
  syntheticMobile,
} from './otp-helpers';

const SHOTS = process.env.E2E_SCREENSHOT_DIR;

/**
 * OTP sign-up, setup, routing and sessions in the browser (AC-01 to AC-05, PR-01, PO-03), on the
 * mobile, tablet and desktop projects. Needs the API with the `accounts` flag and the local SMS
 * inbox (Mailpit): runs when E2E_API=1.
 */
test.describe('Sign-up and account setup', () => {
  test.skip(!process.env.E2E_API, 'Needs the API, database and Mailpit (E2E_API=1)');

  for (const locale of LOCALES) {
    const t = CATALOGUES[locale];

    test(`AC-01 PR-01 a new patient signs up and finishes setup in ${locale}`, async ({
      page,
    }, info) => {
      await signInByOtp(page, locale, syntheticMobile());
      await expect(page).toHaveURL(new RegExp(`/${locale}/setup/role$`));
      // Doctor, dentist and dermatologist are deferred beyond the MVP and not offered (ADR 0015).
      await expect(page.getByRole('radio', { name: t.roles.nurse.label })).toBeVisible();
      for (const role of ['doctor', 'dentist', 'dermatologist'] as const) {
        await expect(page.getByRole('radio', { name: t.roles[role].label })).toHaveCount(0);
      }
      if (SHOTS)
        await page.screenshot({
          path: `${SHOTS}/setup-role-${locale}-${info.project.name}.png`,
          fullPage: true,
        });
      await completePatientSetup(page, locale, 'Synthetic Patient');
      await expect(page).toHaveURL(new RegExp(`/${locale}$`));
      await page.goto(`/${locale}/account`);
      await expect(page.getByRole('heading', { name: t.account.title })).toBeVisible();
      await expect(page.getByText(t.account.using)).toBeVisible();
      if (SHOTS)
        await page.screenshot({
          path: `${SHOTS}/account-${locale}-${info.project.name}.png`,
          fullPage: true,
        });
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflows).toBe(false);
    });
  }

  test('SE-08 a wrong code shows a clear error and keeps the input', async ({ page }) => {
    const t = CATALOGUES.en;
    await page.goto('/en/sign-in');
    await page.getByLabel(t.signIn.mobileLabel).fill('12345');
    await page.getByRole('button', { name: t.signIn.sendCode }).click();
    await expect(page.getByText(t.errors.mobile_invalid)).toBeVisible();
    await page.getByLabel(t.signIn.mobileLabel).fill(syntheticMobile());
    await page.getByRole('button', { name: t.signIn.sendCode }).click();
    await expect(page.getByText(/You can ask for a new code in \d+ seconds?/)).toBeVisible();
    await page.getByLabel(t.signIn.codeLabel).fill('000000');
    await page.getByRole('button', { name: t.signIn.verify, exact: true }).click();
    await expect(page.getByText(t.errors.otp_incorrect)).toBeVisible();
    await expect(page.getByLabel(t.signIn.codeLabel)).toHaveValue('000000');
  });

  test('PO-03 setup saved on one device resumes on another, then a provider sees a draft application', async ({
    browser,
  }) => {
    const t = CATALOGUES.en;
    const mobile = syntheticMobile();
    const first = await (await browser.newContext()).newPage();
    await signInByOtp(first, 'en', mobile);
    await first.getByRole('radio', { name: t.roles.nurse.label }).check();
    await first.getByRole('button', { name: t.setup.continue, exact: true }).click();
    await first.getByLabel(t.setup.details.fullName).fill('Synthetic Nurse');
    await first.getByRole('button', { name: t.setup.saveLater }).click();
    await expect(first.getByText(t.setup.saved)).toBeVisible();

    const second = await (await browser.newContext()).newPage();
    await signInByOtp(second, 'en', mobile);
    await expect(second).toHaveURL(/\/en\/setup\/details$/);
    await expect(second.getByLabel(t.setup.details.fullName)).toHaveValue('Synthetic Nurse');
    await second.getByRole('button', { name: t.setup.continue, exact: true }).click();
    await expect(second.getByRole('alert').first()).toContainText(t.setup.details.genderRequired);
    await second.getByRole('radio', { name: t.genders.female }).check();
    await second.getByRole('checkbox', { name: t.locale.or }).check();
    await second.getByRole('checkbox', { name: t.setup.details.adult }).check();
    await second.getByRole('button', { name: t.setup.continue, exact: true }).click();
    await second.getByRole('checkbox', { name: t.setup.consent.terms }).check();
    await second.getByRole('checkbox', { name: t.setup.consent.privacy }).check();
    await second.getByRole('button', { name: t.setup.consent.finish, exact: true }).click();
    await expect(second).toHaveURL(/\/en\/provider$/);
    await expect(second.getByText(t.application.status.draft)).toBeVisible();
    await expect(second.getByText(t.application.steps.identity)).toBeVisible();
  });

  test('SE-02 a protected page asks for sign-in and returns there afterwards', async ({ page }) => {
    const t = CATALOGUES.hi;
    const mobile = syntheticMobile();
    await signInByOtp(page, 'hi', mobile);
    await completePatientSetup(page, 'hi', 'सीता साहू');
    await page.getByRole('link', { name: t.nav.account }).click();
    await page.getByRole('button', { name: t.account.signOut, exact: true }).click();
    await expect(page).toHaveURL(/\/hi\/sign-in(\?next=.*)?$/);
    await page.goto('/hi/account');
    await expect(page).toHaveURL(/\/hi\/sign-in\?next=%2Fhi%2Faccount$/);
    await signInByOtp(page, 'hi', mobile);
    await expect(page).toHaveURL(/\/hi\/account$/);
    await page.goto('/hi/provider');
    await expect(page.getByText(t.guard.wrongRole)).toBeVisible();
  });
});

test.describe('Roles and sessions', () => {
  test.skip(!process.env.E2E_API, 'Needs the API, database and Mailpit (E2E_API=1)');

  test('AC-05 adding the provider side asks for a fresh code; switching takes the user to the application', async ({
    page,
  }) => {
    const t = CATALOGUES.or;
    const mobile = syntheticMobile();
    await signInByOtp(page, 'or', mobile);
    await completePatientSetup(page, 'or', 'ସୀତା ସାହୁ');
    await page.goto('/or/account');
    await page.getByRole('radio', { name: t.roles.attendant.label }).check();
    await page.getByRole('checkbox', { name: t.locale.or }).check();
    await page.getByRole('button', { name: t.account.addTitle, exact: true }).click();
    const sheet = page.getByRole('dialog', { name: t.reverify.title });
    await expect(sheet).toBeVisible();
    const before = await inboxOf(mobile);
    await sheet.getByRole('button', { name: t.reverify.send }).click();
    await sheet.getByLabel(t.signIn.codeLabel).fill(await codeFor(mobile, before));
    await sheet.getByRole('button', { name: t.reverify.confirm }).click();
    await expect(page.getByText(t.account.roleAdded)).toBeVisible();
    await page
      .getByRole('button', { name: t.account.switchTo.replace('{role}', t.roles.attendant.name) })
      .click();
    await expect(page).toHaveURL(/\/or\/provider$/);
    await expect(page.getByText(t.application.status.draft)).toBeVisible();
  });

  test('SE-07.3 signing out of all devices ends the other browser too', async ({ browser }) => {
    const t = CATALOGUES.en;
    const mobile = syntheticMobile();
    const phone = await (await browser.newContext()).newPage();
    await signInByOtp(phone, 'en', mobile);
    await completePatientSetup(phone, 'en', 'Synthetic Person');
    const laptop = await (await browser.newContext()).newPage();
    await signInByOtp(laptop, 'en', mobile);
    await expect(laptop).toHaveURL(/\/en$/);
    await laptop.goto('/en/account');
    await laptop.getByRole('button', { name: t.account.signOutAll }).click();
    await expect(laptop).toHaveURL(/\/en\/sign-in(\?next=.*)?$/);
    await phone.goto('/en/account');
    await expect(phone).toHaveURL(/\/en\/sign-in\?next=/);
  });

  test('AC-02 the first visit asks for a language and remembers it', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/(or|en|hi)\/welcome$/);
    await page.getByRole('region').getByRole('link', { name: CATALOGUES.hi.locale.hi }).click();
    await expect(page).toHaveURL(/\/hi$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/hi$/);
  });
});
