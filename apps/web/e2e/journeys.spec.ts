import { CATALOGUES, formatIcu, LOCALES, type Locale, type MessageValues } from '@heach/i18n';
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
 * The booking journeys in the browser, in Odia, English and Hindi (Step 10 regression, FU-40).
 * Providers and plans are made through the API as other people would; every step the patient
 * takes is in the browser. Needs the API, database and Mailpit: runs when E2E_API=1.
 */
type Messages = (typeof CATALOGUES)[Locale];

/** A page in one language: its catalogue, its URLs and its formatted messages. */
class InLanguage {
  readonly t: Messages;

  constructor(
    readonly page: Page,
    readonly locale: Locale,
  ) {
    this.t = CATALOGUES[locale];
  }

  goto(path: string) {
    return this.page.goto(`/${this.locale}${path}`);
  }

  /** A message as the app renders it, numbers and all. */
  say(pattern: string, values: MessageValues = {}): string {
    return formatIcu(pattern, values, this.locale);
  }

  /** A message whose placeholders may hold anything, such as an amount. */
  like(pattern: string): RegExp {
    const escaped = pattern.replaceAll(/[.*+?^$()|[\]\\]/g, String.raw`\$&`);
    return new RegExp(`^${escaped.replaceAll(/\{\w+\}/g, '.+')}$`);
  }

  card(title: string) {
    return this.page
      .locator('.heach-card')
      .filter({ has: this.page.getByRole('heading', { name: title }) });
  }

  /** The code the booking page shows now: start, check-in or check-out, or lab collection. */
  async shownCode(button: string): Promise<string> {
    await this.page.getByRole('button', { name: button }).click();
    const shown = (await this.page.locator('.visit-code').textContent()) ?? '';
    return /\d{6}/.exec(shown)?.[0] ?? '';
  }
}

const PDF = {
  name: 'record.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.7\n% synthetic record\n'),
};

async function newPatient(lang: InLanguage): Promise<void> {
  await signInByOtp(lang.page, lang.locale, syntheticMobile());
  await completePatientSetup(lang.page, lang.locale, 'Synthetic Patient');
  await expect(lang.page).not.toHaveURL(/\/setup\//);
}

/** From search to the booking form: the provider's card, a free time, the address. */
async function startBooking(lang: InLanguage, provider: Provider, service: string, item: string) {
  const { page, t } = lang;
  // The name narrows the search: a shared local database may hold many matching providers.
  const query = new URLSearchParams({ pin: PILOT_PIN, item, q: provider.name });
  await lang.goto(`/services/${service}?${query.toString()}`);
  const card = page.getByRole('listitem').filter({ hasText: provider.name });
  await card.getByRole('link', { name: t.search.view }).click();
  await page.locator(`a[href*="/${lang.locale}/book/${provider.listingId}"]`).first().click();
  await page.getByLabel(t.book.address).fill('12 Synthetic Lane, Bhubaneswar');
  await page.getByLabel(t.book.pin).fill(PILOT_PIN);
}

async function pay(lang: InLanguage): Promise<void> {
  const { page, t } = lang;
  await page.getByRole('button', { name: t.book.continue }).click();
  await expect(page.getByRole('heading', { name: t.book.reviewTitle })).toBeVisible();
  await page.getByRole('button', { name: lang.like(t.book.pay) }).click();
  await expect(page.getByText(t.book.paid)).toBeVisible();
}

/** J3 steps 1 to 5: booked, paid, accepted, started with the patient's code and completed. */
async function visitDone(lang: InLanguage, nurse: Provider): Promise<string> {
  await startBooking(lang, nurse, 'nursing', 'nursing_vitals_check');
  await pay(lang);
  const bookingId = await acceptNewest(nurse);
  startSoon(bookingId);
  await lang.goto(`/bookings/${bookingId}`);
  await startAndComplete(nurse, bookingId, await lang.shownCode(lang.t.visit.showCode));
  return bookingId;
}

/** J3: a home visit booked, started with the patient's code, completed and rated. */
async function j3(lang: InLanguage): Promise<void> {
  const { page } = lang;
  const nurse = await listedProvider('nurse', 'nursing_vitals_check', 40_000);
  await newPatient(lang);
  await visitDone(lang, nurse);
  await page.reload();
  await page.getByLabel(lang.t.visit.stars).fill('5');
  await page.getByRole('button', { name: lang.t.visit.rate }).click();
  await expect(page.getByText(lang.t.visit.rated)).toBeVisible();
}

/** J4: an attendant booked for two days, the balance paid, a shift checked in and out. */
async function j4(lang: InLanguage): Promise<void> {
  const { page, t } = lang;
  const attendant = await listedProvider('attendant', 'attendant_day_12h', 100_000);
  await newPatient(lang);
  await startBooking(lang, attendant, 'attendant', 'attendant_day_12h');
  await page.getByLabel(t.book.days).fill('2');
  await pay(lang);
  const bookingId = await acceptNewest(attendant);
  startSoon(bookingId, -10);
  await lang.goto(`/bookings/${bookingId}`);
  const balance = page.getByRole('button', { name: lang.like(t.bookings.payBalance) });
  await balance.click();
  await expect(balance).toBeHidden();
  for (const move of ['check-in', 'check-out'] as const) {
    await page.reload();
    await shiftCheck(attendant, bookingId, 0, move, await lang.shownCode(t.visit.showCode));
  }
  await page.reload();
  await expect(
    page.getByText(lang.say(t.visit.shift, { day: 1, status: t.visit.shiftStatus.checked_out })),
  ).toBeVisible();
}

/** J7: a walk-in lab test collected with the patient's code, through to the report. */
async function j7(lang: InLanguage): Promise<void> {
  const { page } = lang;
  const lab = await listedProvider('lab', 'lab_cbc', 30_000);
  await newPatient(lang);
  await startBooking(lang, lab, 'lab', 'lab_cbc');
  await page.getByRole('radio', { name: lang.t.lab.walkIn }).check();
  await pay(lang);
  const bookingId = await acceptNewest(lab);
  await lang.goto(`/bookings/${bookingId}`);
  await labCollectAndReport(lab, bookingId, await lang.shownCode(lang.t.lab.showCode));
  await page.reload();
  await expect(page.getByText(lang.t.lab.stage.report_ready)).toBeVisible();
  await expect(page.getByRole('button', { name: lang.t.lab.report })).toBeVisible();
}

/** J8: a package bought, then a booking paid with it; what is left goes down. */
async function j8(lang: InLanguage): Promise<void> {
  const { page, t } = lang;
  const nurse = await listedProvider('nurse', 'nursing_injection', 30_000);
  const planName = await packagePlan('nursing_injection', 3, 80_000);
  await newPatient(lang);
  await lang.goto('/plans');
  const plan = page.locator('.heach-card').filter({ hasText: planName });
  await expect(
    plan.getByText(lang.say(t.plans.includes, { text: 'Synthetic home visits' })),
  ).toBeVisible();
  await plan.getByRole('button', { name: lang.like(t.plans.buy) }).click();
  await expect(page.getByText(lang.say(t.plans.left, { left: 3, total: 3 }))).toBeVisible();

  await startBooking(lang, nurse, 'nursing', 'nursing_injection');
  // Injections need the doctor's prescription before the provider accepts (J3 step 3).
  await page.getByLabel(t.book.prescription).setInputFiles(PDF);
  await page.getByLabel(t.plans.usePlan).selectOption({ label: planName });
  await pay(lang);
  await lang.goto('/plans');
  await expect(page.getByText(lang.say(t.plans.left, { left: 2, total: 3 }))).toBeVisible();
}

/** J9: visit notes filed by themselves, an older record, history and an outside link. */
async function j9(lang: InLanguage): Promise<void> {
  const { page, t } = lang;
  const nurse = await listedProvider('nurse', 'nursing_vitals_check', 40_000);
  await newPatient(lang);
  await visitDone(lang, nurse);
  await lang.goto('/vault');
  await expect(page.getByText(lang.say(t.vault.issuedBy, { name: nurse.name }))).toBeVisible();

  const upload = lang.card(t.vault.uploadTitle);
  await upload.getByLabel(t.vault.type).selectOption('prescription');
  await upload.getByLabel(t.vault.recordTitle).fill('Synthetic old prescription');
  await upload.getByLabel(t.vault.recordDate).fill('2026-09-01');
  await upload.getByLabel(t.vault.file).setInputFiles(PDF);
  await upload.getByRole('button', { name: t.vault.save }).click();
  await expect(upload.getByText(t.vault.saved)).toBeVisible();

  const history = lang.card(t.vault.historyTitle);
  await history.getByLabel(t.vault.historyText).fill('Synthetic allergy to penicillin');
  await history.getByRole('button', { name: t.vault.addHistory }).click();
  await expect(history.getByText('Synthetic allergy to penicillin')).toBeVisible();

  const link = lang.card(t.vault.linkTitle);
  await link.getByRole('checkbox', { name: /Synthetic old prescription/ }).check();
  await link.getByRole('button', { name: t.vault.createLink }).click();
  await expect(link.getByText(t.vault.linkCreated)).toBeVisible();
}

for (const locale of LOCALES) {
  test.describe(`Booking journeys in the browser, in ${locale} (J3, J4, J7, J8, J9)`, () => {
    test.skip(!process.env.E2E_API, 'Needs the API, database and Mailpit (E2E_API=1)');
    test.describe.configure({ timeout: 120_000 });

    test(`J3 a patient books a home nurse, shares the start code and rates the visit, in ${locale}`, async ({
      page,
    }) => {
      await j3(new InLanguage(page, locale));
    });

    test(`J4 a patient books an attendant, pays the balance, and a shift is checked in and out, in ${locale}`, async ({
      page,
    }) => {
      await j4(new InLanguage(page, locale));
    });

    test(`J7 a patient books a walk-in lab test and gets the report, in ${locale}`, async ({
      page,
    }) => {
      await j7(new InLanguage(page, locale));
    });

    test(`J8 a patient buys a package and books with it, seeing what is left, in ${locale}`, async ({
      page,
    }) => {
      await j8(new InLanguage(page, locale));
    });

    test(`J9 visit notes are filed by themselves; a record, history and an outside link, in ${locale}`, async ({
      page,
    }) => {
      await j9(new InLanguage(page, locale));
    });
  });
}
