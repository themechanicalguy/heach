import { CATALOGUES } from '@heach/i18n';
import { expect, type Page, test } from '@playwright/test';
import { completePatientSetup, signInByOtp, syntheticMobile } from './otp-helpers';
import {
  acceptNewest,
  labCollectAndReport,
  listedProvider,
  packagePlan,
  PILOT_PIN,
  type Provider,
  shiftCheck,
  startAndComplete,
  startSoon,
} from './seed';

/**
 * The booking journeys in the browser (Step 10 regression, FU-40). Providers and plans are made
 * through the API as other people would; every step the patient takes is in the browser. Needs
 * the API, database and Mailpit: runs when E2E_API=1.
 */
const t = CATALOGUES.en;

async function newPatient(page: Page): Promise<void> {
  await signInByOtp(page, 'en', syntheticMobile());
  await completePatientSetup(page, 'en', 'Synthetic Patient');
  await expect(page).not.toHaveURL(/\/setup\//);
}

/** From search to a paid request: the provider's card, a free time, the address, payment. */
async function bookAndPay(page: Page, provider: Provider, service: string, item: string) {
  // The name narrows the search: a shared local database may hold many matching providers.
  const query = new URLSearchParams({ pin: PILOT_PIN, item, q: provider.name });
  await page.goto(`/en/services/${service}?${query.toString()}`);
  const card = page.getByRole('listitem').filter({ hasText: provider.name });
  await card.getByRole('link', { name: t.search.view }).click();
  await page.locator(`a[href*="/en/book/${provider.listingId}"]`).first().click();
  await page.getByLabel(t.book.address).fill('12 Synthetic Lane, Bhubaneswar');
  await page.getByLabel(t.book.pin).fill(PILOT_PIN);
}

/** J3 steps 1 to 5: booked, paid, accepted, started with the patient's code and completed. */
async function visitDone(page: Page, nurse: Provider): Promise<string> {
  await bookAndPay(page, nurse, 'nursing', 'nursing_vitals_check');
  await pay(page);
  const bookingId = await acceptNewest(nurse);
  startSoon(bookingId);
  await page.goto(`/en/bookings/${bookingId}`);
  await page.getByRole('button', { name: t.visit.showCode }).click();
  const shown = (await page.locator('.visit-code').textContent()) ?? '';
  await startAndComplete(nurse, bookingId, /\d{6}/.exec(shown)?.[0] ?? '');
  return bookingId;
}

/** The code the booking page shows now: start, check-in or check-out, or lab collection. */
async function shownCode(page: Page, button: string): Promise<string> {
  await page.getByRole('button', { name: button }).click();
  const shown = (await page.locator('.visit-code').textContent()) ?? '';
  return /\d{6}/.exec(shown)?.[0] ?? '';
}

const card = (page: Page, title: string) =>
  page.locator('.heach-card').filter({ has: page.getByRole('heading', { name: title }) });

const PDF = {
  name: 'record.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.7\n% synthetic record\n'),
};

async function pay(page: Page): Promise<void> {
  await page.getByRole('button', { name: t.book.continue }).click();
  await expect(page.getByRole('heading', { name: t.book.reviewTitle })).toBeVisible();
  await page.getByRole('button', { name: /^Pay / }).click();
  await expect(page.getByText(t.book.paid)).toBeVisible();
}

test.describe('Booking journeys in the browser (J3, J4, J7, J8, J9)', () => {
  test.skip(!process.env.E2E_API, 'Needs the API, database and Mailpit (E2E_API=1)');
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  test('J3 a patient books a home nurse, shares the start code and rates the visit', async ({
    page,
  }) => {
    const nurse = await listedProvider('nurse', 'nursing_vitals_check', 40_000);
    await newPatient(page);
    await visitDone(page, nurse);
    await page.reload();
    await page.getByLabel(t.visit.stars).fill('5');
    await page.getByRole('button', { name: t.visit.rate }).click();
    await expect(page.getByText(t.visit.rated)).toBeVisible();
  });

  test('J8 a patient buys a package and books with it, seeing what is left', async ({ page }) => {
    const nurse = await listedProvider('nurse', 'nursing_injection', 30_000);
    const planName = await packagePlan('nursing_injection', 3, 80_000);
    await newPatient(page);
    await page.goto('/en/plans');
    const plan = page.locator('.heach-card').filter({ hasText: planName });
    await expect(plan.getByText('Includes: Synthetic home visits')).toBeVisible();
    await plan.getByRole('button', { name: /^Buy for / }).click();
    await expect(
      page.getByText(t.plans.left.replace('{left}', '3').replace('{total}', '3')),
    ).toBeVisible();

    await bookAndPay(page, nurse, 'nursing', 'nursing_injection');
    // Injections need the doctor's prescription before the provider accepts (J3 step 3).
    await page.getByLabel(t.book.prescription).setInputFiles(PDF);
    await page.getByLabel(t.plans.usePlan).selectOption({ label: planName });
    await pay(page);
    await page.goto('/en/plans');
    await expect(
      page.getByText(t.plans.left.replace('{left}', '2').replace('{total}', '3')),
    ).toBeVisible();
  });

  test('J9 visit notes are filed by themselves; the patient adds a record and history and shares a link', async ({
    page,
  }) => {
    const nurse = await listedProvider('nurse', 'nursing_vitals_check', 40_000);
    await newPatient(page);
    await visitDone(page, nurse);
    await page.goto('/en/vault');
    await expect(page.getByText(t.vault.issuedBy.replace('{name}', nurse.name))).toBeVisible();

    const upload = card(page, t.vault.uploadTitle);
    await upload.getByLabel(t.vault.type).selectOption('prescription');
    await upload.getByLabel(t.vault.recordTitle).fill('Synthetic old prescription');
    await upload.getByLabel(t.vault.recordDate).fill('2026-09-01');
    await upload.getByLabel(t.vault.file).setInputFiles(PDF);
    await upload.getByRole('button', { name: t.vault.save }).click();
    await expect(upload.getByText(t.vault.saved)).toBeVisible();
    await expect(page.getByText('Synthetic old prescription').first()).toBeVisible();

    const history = card(page, t.vault.historyTitle);
    await history.getByLabel(t.vault.historyText).fill('Synthetic allergy to penicillin');
    await history.getByRole('button', { name: t.vault.addHistory }).click();
    await expect(history.getByText('Synthetic allergy to penicillin')).toBeVisible();

    const link = card(page, t.vault.linkTitle);
    await link.getByRole('checkbox', { name: /Synthetic old prescription/ }).check();
    await link.getByRole('button', { name: t.vault.createLink }).click();
    await expect(link.getByText(t.vault.linkCreated)).toBeVisible();
  });

  test('J4 a patient books a bedside attendant, pays the balance, and each shift is checked in and out', async ({
    page,
  }) => {
    const attendant = await listedProvider('attendant', 'attendant_day_12h', 100_000);
    await newPatient(page);
    await bookAndPay(page, attendant, 'attendant', 'attendant_day_12h');
    await page.getByLabel(t.book.days).fill('2');
    await pay(page);
    const bookingId = await acceptNewest(attendant);
    startSoon(bookingId, -10);
    await page.goto(`/en/bookings/${bookingId}`);
    const balance = page.getByRole('button', { name: /^Pay balance / });
    await balance.click();
    await expect(balance).toBeHidden();
    await page.reload();
    await shiftCheck(attendant, bookingId, 0, 'check-in', await shownCode(page, t.visit.showCode));
    await page.reload();
    await shiftCheck(attendant, bookingId, 0, 'check-out', await shownCode(page, t.visit.showCode));
    await page.reload();
    await expect(
      page.getByText(
        t.visit.shift.replace('{day}', '1').replace('{status}', t.visit.shiftStatus.checked_out),
      ),
    ).toBeVisible();
  });

  test('J7 a patient books a walk-in lab test and downloads the report', async ({ page }) => {
    const lab = await listedProvider('lab', 'lab_cbc', 30_000);
    await newPatient(page);
    await bookAndPay(page, lab, 'lab', 'lab_cbc');
    await page.getByRole('radio', { name: t.lab.walkIn }).check();
    await pay(page);
    const bookingId = await acceptNewest(lab);
    await page.goto(`/en/bookings/${bookingId}`);
    await labCollectAndReport(lab, bookingId, await shownCode(page, t.lab.showCode));
    await page.reload();
    await expect(page.getByText(t.lab.stage.report_ready)).toBeVisible();
    await expect(page.getByRole('button', { name: t.lab.report })).toBeVisible();
  });
});
