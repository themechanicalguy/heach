import { CATALOGUES, LOCALES } from '@heach/i18n';
import { expect, test } from '@playwright/test';
import {
  codeFor,
  completePatientSetup,
  completeProviderSetup,
  confirmItIsMe,
  inboxOf,
  signInByOtp,
  syntheticMobile,
} from './otp-helpers';

/**
 * Account journeys beyond sign-up (AC-03, AC-06, PR-04, owner decisions O-1 and O-3) on the
 * mobile, tablet and desktop projects. Needs the API with the `accounts` flag and Mailpit as the
 * SMS inbox: runs when E2E_API=1.
 */

test.describe('Linked patients (AC-03)', () => {
  test.skip(!process.env.E2E_API, 'Needs the API, database and Mailpit (E2E_API=1)');

  for (const locale of LOCALES) {
    const t = CATALOGUES[locale];
    test(`AC-03 a patient adds, edits and removes a person they book for, in ${locale}`, async ({
      page,
    }) => {
      await signInByOtp(page, locale, syntheticMobile());
      await completePatientSetup(page, locale, 'Synthetic Parent');
      await page.goto(`/${locale}/account`);
      await page.getByRole('link', { name: t.people.title }).click();
      await expect(page.getByText(t.people.empty)).toBeVisible();

      await page.getByRole('button', { name: t.people.add, exact: true }).click();
      await page.getByRole('button', { name: t.people.save, exact: true }).click();
      await expect(page.getByText(t.people.birthYearInvalid).first()).toBeVisible();
      await page.getByLabel(t.people.fullName).fill('ସମୀର ସାହୁ');
      await page.getByLabel(t.people.birthYear).fill('2016');
      await page.getByRole('radio', { name: t.genders.male, exact: true }).check();
      await page.getByRole('radio', { name: t.people.relationships.child, exact: true }).check();
      await page.getByRole('button', { name: t.people.save, exact: true }).click();
      await expect(page.getByRole('heading', { name: 'ସମୀର ସାହୁ' })).toBeVisible();

      await page.getByRole('button', { name: t.people.edit, exact: true }).click();
      await page.getByLabel(t.people.fullName).fill('Samir Sahu');
      await page.getByRole('button', { name: t.people.save, exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Samir Sahu' })).toBeVisible();

      await page.getByRole('button', { name: t.people.remove, exact: true }).click();
      await page
        .getByRole('button', { name: t.people.confirmRemove.replace('{name}', 'Samir Sahu') })
        .click();
      await expect(page.getByText(t.people.empty)).toBeVisible();
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflows).toBe(false);
    });
  }
});

test.describe('Staff invitation, membership and removal (O-1, D-7)', () => {
  test.skip(!process.env.E2E_API, 'Needs the API, database and Mailpit (E2E_API=1)');

  test('O-1 a lab invites a collector who joins through setup; removal signs them out', async ({
    browser,
  }) => {
    const t = CATALOGUES.en;
    const ownerMobile = syntheticMobile();
    const collectorMobile = syntheticMobile();
    const owner = await (await browser.newContext()).newPage();
    await signInByOtp(owner, 'en', ownerMobile);
    await completeProviderSetup(owner, 'lab', 'Synthetic Lab Owner');
    await owner.goto('/en/team');
    await expect(owner.getByText(t.team.notApproved)).toBeVisible();
    await owner.getByLabel(t.team.inviteMobile).fill(collectorMobile);
    await owner.getByRole('button', { name: t.team.invite, exact: true }).click();
    await confirmItIsMe(owner, 'en', ownerMobile);
    await expect(owner.getByText(t.team.invited)).toBeVisible();

    const collector = await (await browser.newContext()).newPage();
    await signInByOtp(collector, 'en', collectorMobile);
    await expect(collector).toHaveURL(/\/en\/setup\/role$/);
    await expect(
      collector.getByRole('radio', { name: t.roles.sample_collector.label, exact: true }),
    ).toHaveCount(0);
    await collector.getByRole('radio', { name: /sample collector at Synthetic E2E Lab/ }).check();
    await collector.getByRole('button', { name: t.setup.continue, exact: true }).click();
    await collector.getByLabel(t.setup.details.fullName).fill('Synthetic Collector');
    await collector.getByRole('radio', { name: t.genders.female, exact: true }).check();
    await collector.getByRole('checkbox', { name: t.setup.details.adult }).check();
    await collector.getByRole('button', { name: t.setup.continue, exact: true }).click();
    await collector.getByRole('checkbox', { name: t.setup.consent.terms }).check();
    await collector.getByRole('checkbox', { name: t.setup.consent.privacy }).check();
    await collector.getByRole('button', { name: t.setup.consent.finish, exact: true }).click();
    await expect(collector).toHaveURL(/\/en\/provider$/);
    await expect(collector.getByRole('heading', { name: t.staff.title })).toBeVisible();
    await expect(collector.getByText('Synthetic E2E Lab')).toBeVisible();
    await expect(collector.getByText(t.staff.notApproved)).toBeVisible();

    await owner.reload();
    await owner.getByRole('button', { name: t.team.remove, exact: true }).click();
    await owner.getByRole('button', { name: t.team.confirmRemove, exact: true }).click();
    await expect(owner.getByText(t.team.empty)).toBeVisible();

    await collector.goto('/en/account');
    await expect(collector).toHaveURL(/\/en\/sign-in/);
  });
});

test.describe('Number change and data rights (O-3, AC-06, PR-04)', () => {
  test.skip(!process.env.E2E_API, 'Needs the API, database and Mailpit (E2E_API=1)');

  test('O-3 a user moves the account to a new number with a code to each number', async ({
    page,
  }) => {
    const t = CATALOGUES.en;
    const mobile = syntheticMobile();
    const newMobile = syntheticMobile();
    await signInByOtp(page, 'en', mobile);
    await completePatientSetup(page, 'en', 'Synthetic Mover');
    await page.goto('/en/account');
    await page.getByRole('button', { name: t.mobileChange.start, exact: true }).click();
    await page.getByLabel(t.mobileChange.newNumber).fill(newMobile);
    await page.getByRole('button', { name: t.mobileChange.sendCode, exact: true }).click();
    const before = await inboxOf(newMobile);
    await confirmItIsMe(page, 'en', mobile);
    await page.getByLabel(t.signIn.codeLabel).fill(await codeFor(newMobile, before));
    await page.getByRole('button', { name: t.mobileChange.confirm, exact: true }).click();
    await expect(page.getByText(t.mobileChange.done)).toBeVisible();
    await expect(page.getByText(newMobile.slice(-4))).toBeVisible();
  });

  test('AC-06 a user corrects their name, asks for deletion after a code, then withdraws it', async ({
    page,
  }) => {
    const t = CATALOGUES.hi;
    const mobile = syntheticMobile();
    await signInByOtp(page, 'hi', mobile);
    await completePatientSetup(page, 'hi', 'Synthetic Name');
    await page.goto('/hi/account');
    await page.getByRole('button', { name: t.profile.edit, exact: true }).click();
    await page.getByLabel(t.setup.details.fullName).fill('सीता देवी');
    await page.getByRole('button', { name: t.profile.save, exact: true }).click();
    await expect(page.getByText('सीता देवी')).toBeVisible();

    await page.getByRole('button', { name: t.dataRights.delete, exact: true }).click();
    await confirmItIsMe(page, 'hi', mobile);
    await expect(
      page.getByRole('button', { name: t.dataRights.cancel, exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: t.dataRights.cancel, exact: true }).click();
    await expect(
      page.getByRole('button', { name: t.dataRights.delete, exact: true }),
    ).toBeVisible();

    const stored = await page.evaluate(() =>
      JSON.stringify([
        Object.entries(localStorage),
        Object.entries(sessionStorage),
        document.cookie,
      ]),
    );
    expect(stored).not.toContain(mobile);
    expect(stored).not.toContain('सीता');
  });
});
