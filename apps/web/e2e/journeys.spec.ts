import { LOCALES } from '@heach/i18n';
import { test } from './test';
import { InLanguage, j3, j4, j7, j8, j9 } from './journey-steps';

/**
 * The booking journeys in the browser, in Odia, English and Hindi (Step 10 regression, FU-40).
 * Every step the patient takes is in the browser (./journey-steps). Needs the API, database and
 * Mailpit: runs when E2E_API=1.
 */
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
