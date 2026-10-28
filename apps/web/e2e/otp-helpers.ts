import { randomInt } from 'node:crypto';
import { CATALOGUES, type Locale } from '@heach/i18n';
import { expect, type Page } from '@playwright/test';

/** Mailpit's API, where the local SMS adapter delivers every SMS (decision L-8). */
const MAILPIT = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';

/** A random synthetic number; local SMS never leave this machine. */
export function syntheticMobile(): string {
  return `90${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
}

interface MailpitList {
  messages: { ID: string }[];
}

async function messagesTo(mobile: string): Promise<string[]> {
  const query = encodeURIComponent(`to:"91${mobile}@sms.heach.local"`);
  const list = (await (
    await fetch(`${MAILPIT}/api/v1/search?query=${query}`)
  ).json()) as MailpitList;
  return list.messages.map((message) => message.ID);
}

/** The IDs already in the inbox for this number, taken before an action that sends a code. */
export const inboxOf = messagesTo;

/** The code in the first SMS to this number that was not in `before`. */
export async function codeFor(mobile: string, before: readonly string[]): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const fresh = (await messagesTo(mobile)).find((id) => !before.includes(id));
    if (fresh) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh}`)).json()) as {
        Text: string;
      };
      const code = /\d{6}/.exec(message.Text)?.[0];
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('No SMS arrived in Mailpit');
}

/** Signs in with a mobile number through the real form and the local SMS inbox. */
export async function signInByOtp(page: Page, locale: Locale, mobile: string): Promise<void> {
  const t = CATALOGUES[locale];
  if (!page.url().includes('/sign-in')) await page.goto(`/${locale}/sign-in`);
  const before = await inboxOf(mobile);
  await page.getByLabel(t.signIn.mobileLabel).fill(mobile);
  await page.getByRole('button', { name: t.signIn.sendCode, exact: true }).click();
  await expect(page.getByRole('heading', { name: t.signIn.codeTitle })).toBeVisible();
  await page.getByLabel(t.signIn.codeLabel).fill(await codeFor(mobile, before));
  await page.getByRole('button', { name: t.signIn.verify, exact: true }).click();
}

/** Finishes setup as a patient, in the given language. */
export async function completePatientSetup(
  page: Page,
  locale: Locale,
  name: string,
): Promise<void> {
  const t = CATALOGUES[locale];
  await expect(page).toHaveURL(new RegExp(`/${locale}/setup/role$`));
  await page.getByRole('radio', { name: t.roles.patient.label }).check();
  await page.getByRole('button', { name: t.setup.continue, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/setup/details$`));
  await page.getByLabel(t.setup.details.fullName).fill(name);
  await page.getByRole('radio', { name: t.genders.female }).check();
  await page.getByRole('checkbox', { name: t.setup.details.adult }).check();
  await page.getByRole('button', { name: t.setup.continue, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/setup/consent$`));
  await page.getByRole('checkbox', { name: t.setup.consent.terms }).check();
  await page.getByRole('checkbox', { name: t.setup.consent.privacy }).check();
  await page.getByRole('button', { name: t.setup.consent.finish, exact: true }).click();
}
