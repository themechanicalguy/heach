import { execFileSync } from 'node:child_process';
import { CATALOGUES } from '@heach/i18n';
import { _android as android, type AndroidDevice } from '@playwright/test';
import { expect, type Page, test } from './test';
import { InLanguage, pay, startBooking } from './journey-steps';
import {
  completePatientSetup,
  completeProviderSetup,
  signInByOtp,
  syntheticMobile,
} from './otp-helpers';
import { listedProvider, type Provider, startSoon } from './seed';

/**
 * The patient and provider Android apps against each other on an emulator or phone (MA-01 to
 * MA-08): a patient books and pays in HEACH, the nurse accepts, starts and completes the visit in
 * HEACH Provider. Drives the apps' own web views, so it covers what the apps add or change, not
 * the web app again. Needs both debug apps installed, `adb reverse` to the web app, the API,
 * database and Mailpit: runs when E2E_ANDROID=1 (see docs/local-development.md).
 */
const SERVER = process.env.E2E_ANDROID_SERVER ?? 'http://localhost:3000';
const t = CATALOGUES.en;

type App = 'patient' | 'provider';
const appId = (app: App) => `in.heach.${app}.debug`;

/** The package whose screen is showing; undefined while Android is between two screens. */
async function frontPackage(device: AndroidDevice): Promise<string | undefined> {
  const windows = (await device.shell('dumpsys window')).toString();
  return /mCurrentFocus=Window\{\S+ \S+ ([\w.]+)\//.exec(windows)?.[1];
}

/** Whether the app's own screen is the one showing (not the camera or another app over it). */
async function isInFront(device: AndroidDevice, app: App): Promise<boolean> {
  return (await frontPackage(device)) === appId(app);
}

/** Leaves another app that opened over this one (the dialler) with the back button. */
async function backTo(device: AndroidDevice, app: App): Promise<void> {
  await expect
    .poll(async () => {
      const front = await frontPackage(device);
      if (front !== undefined && front !== appId(app))
        await device.shell('input keyevent KEYCODE_BACK');
      return front;
    })
    .toBe(appId(app));
}

/**
 * Brings an app to the front, as tapping its icon does, and returns its page. A running app keeps
 * the page it was on; the connection to a web view is made again each time, because it does not
 * outlive the app going to the background.
 */
async function show(device: AndroidDevice, app: App): Promise<Page> {
  if (!(await isInFront(device, app)))
    await device.shell(`am start -n ${appId(app)}/in.heach.MainActivity`);
  const page = await (await device.webView({ pkg: appId(app) })).page();
  page.setDefaultTimeout(20_000);
  return page;
}

/** The app as just installed: no session, no language chosen. */
async function freshApp(device: AndroidDevice, app: App): Promise<Page> {
  await device.shell(`pm clear ${appId(app)}`);
  return show(device, app);
}

/** Taps a control of another app (the phone's camera) by its resource ID, as a finger would. */
async function tapNative(device: AndroidDevice, id: string): Promise<void> {
  const control = new RegExp(
    `resource-id="${id}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
  );
  await expect
    .poll(async () => {
      const dump = await device.shell(
        'uiautomator dump /sdcard/heach-ui.xml; cat /sdcard/heach-ui.xml',
      );
      const [, left, top, right, bottom] = (control.exec(dump.toString()) ?? []).map(Number);
      if (left === undefined || top === undefined || right === undefined || bottom === undefined)
        return false;
      await device.shell(`input tap ${String((left + right) / 2)} ${String((top + bottom) / 2)}`);
      return true;
    })
    .toBe(true);
}

/**
 * Waits until React has taken over the sign-in form. The apps are tested against the dev server,
 * which hydrates slowly; a number typed before that is lost, on the website as much as here.
 */
async function signIn(page: Page, mobile: string): Promise<void> {
  await expect(page).toHaveURL(/\/en\/sign-in/);
  await page.waitForFunction(() => {
    const input = document.querySelector('main input');
    return input !== null && Object.keys(input).some((key) => key.startsWith('__reactProps'));
  });
  await signInByOtp(page, 'en', mobile);
}

/** A capture of the page for the report; the apps block the phone's own screenshots (MA-04). */
async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: test.info().outputPath(`${name}.png`) }).catch(() => undefined);
}

// One journey across both apps: the tests run in order and share the device and the accounts.
test.skip(!process.env.E2E_ANDROID, 'Needs an Android device with both apps (E2E_ANDROID=1)');
test.describe.configure({ mode: 'serial', timeout: 300_000 });

let device: AndroidDevice;
let nurse: Provider;
let patient: Page;
let provider: Page;
let bookingId: string;

test.beforeAll(async () => {
  const [first] = await android.devices();
  if (!first) throw new Error('No Android device or emulator is connected');
  device = first;
  // The apps load `localhost`; this makes the device's localhost the machine running the web app.
  const port = `tcp:${new URL(SERVER).port}`;
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- adb is the developer's own tool, found on PATH; test only
  execFileSync('adb', ['-s', device.serial(), 'reverse', port, port]);
  nurse = await listedProvider('nurse', 'nursing_vitals_check', 40_000);
});

test.afterAll(async () => {
  await device.close();
});

test('a new patient chooses a language, signs up, books a nurse and pays in HEACH', async () => {
  patient = await freshApp(device, 'patient');
  await expect(patient).toHaveURL(/\/welcome$/);
  await patient.getByRole('link', { name: t.locale.en, exact: true }).click();
  await expect(patient).toHaveURL(`${SERVER}/en`);
  // The first visit asks where care is needed; this patient answers later, on the search form.
  const location = patient.getByRole('dialog');
  await expect(location).toBeVisible();
  await shot(patient, 'patient-home');
  await location.getByRole('button', { name: t.location.skip }).click();
  await patient.getByRole('link', { name: t.nav.signIn }).click();
  await signIn(patient, syntheticMobile());
  await completePatientSetup(patient, 'en', 'Synthetic App Patient');
  await expect(patient).not.toHaveURL(/\/setup\//);
  await shot(patient, 'patient-signed-in');
  const lang = new InLanguage(patient, 'en', SERVER);
  await startBooking(lang, nurse, 'nursing', 'nursing_vitals_check');
  await pay(lang);
  await shot(patient, 'patient-paid');
  bookingId = /\/bookings\/([0-9a-f-]{36})/.exec(patient.url())?.[1] ?? '';
  expect(bookingId).not.toBe('');
});

test("the nurse signs in to HEACH Provider, accepts, and runs the visit with the patient's code", async () => {
  provider = await freshApp(device, 'provider');
  // The provider app opens at the provider area, which asks a new device to sign in.
  await expect(provider).toHaveURL(/\/en\/sign-in\?next=/);
  await signIn(provider, nurse.mobile);
  await expect(provider).toHaveURL(`${SERVER}/en/provider`);
  await shot(provider, 'provider-home');
  await provider.getByRole('link', { name: t.nav.requests }).click();
  await provider.getByRole('button', { name: t.requests.accept, exact: true }).click();
  await expect(provider.getByText(t.requests.empty)).toBeVisible();
  await shot(provider, 'provider-accepted');
  startSoon(bookingId);

  patient = await show(device, 'patient');
  await patient.reload();
  const code = await new InLanguage(patient, 'en', SERVER).shownCode(t.visit.showCode);
  await shot(patient, 'patient-code');

  provider = await show(device, 'provider');
  await provider.getByRole('link', { name: t.nav.bookings }).click();
  await provider.getByRole('button', { name: t.bookings.open }).click();
  // MA-03: the patient's number opens the phone's dialler, outside the app.
  await provider.locator('a[href^="tel:"]').click({ noWaitAfter: true });
  await expect.poll(() => frontPackage(device)).toMatch(/dialer/);
  await backTo(device, 'provider');
  // The page is as it was; the test's connection still waits for the call link's navigation,
  // which the app handed to the dialler, so it loads the page again.
  await provider.goto(`${SERVER}/en/provider/bookings`);
  await provider.getByRole('button', { name: t.bookings.open }).click();
  await provider.getByLabel(t.visit.enterCode).fill(code);
  await provider.getByRole('button', { name: t.visit.start }).click();
  await provider.getByLabel(t.visit.procedure).fill('Synthetic vitals check');
  await provider.getByLabel(t.visit.observations).fill('Synthetic: all normal');
  await provider.getByLabel(t.visit.advice).fill('Rest');
  await provider.getByRole('button', { name: t.visit.complete }).click();
  await expect(provider.getByRole('button', { name: t.visit.complete })).toBeHidden();
  await shot(provider, 'provider-completed');
});

test('the patient rates the visit and finds its notes in Records', async () => {
  patient = await show(device, 'patient');
  await patient.reload();
  await patient.getByLabel(t.visit.stars).fill('5');
  await patient.getByRole('button', { name: t.visit.rate }).click();
  await expect(patient.getByText(t.visit.rated)).toBeVisible();
  await patient.getByRole('link', { name: t.nav.vault }).click();
  await expect(patient.getByText(nurse.name).first()).toBeVisible();
  await shot(patient, 'patient-records');
});

test('the patient photographs an old prescription into Records', async () => {
  const upload = new InLanguage(patient, 'en', SERVER).card(t.vault.uploadTitle);
  await upload.getByLabel(t.vault.type).selectOption('prescription');
  await upload.getByLabel(t.vault.recordTitle).fill('Synthetic old prescription');
  await upload.getByLabel(t.vault.recordDate).fill('2026-09-01');
  await upload.getByLabel(t.app.takePhoto).click();
  await tapNative(device, 'com.android.camera2:id/shutter_button');
  await tapNative(device, 'com.android.camera2:id/done_button');
  // The camera hands the photo back and closes by itself.
  await expect.poll(() => isInFront(device, 'patient')).toBe(true);
  patient = await show(device, 'patient');
  const photo = patient.getByLabel(t.app.takePhoto);
  await expect.poll(() => photo.evaluate((input: HTMLInputElement) => input.files?.length)).toBe(1);
  await shot(patient, 'patient-photo-chosen');
  const form = new InLanguage(patient, 'en', SERVER).card(t.vault.uploadTitle);
  await form.getByRole('button', { name: t.vault.save }).click();
  await shot(patient, 'patient-photo-saving');
  await expect(form.getByText(t.vault.saved)).toBeVisible();

  await shot(patient, 'patient-photo-saved');
});

test('closing and reopening HEACH keeps the patient signed in', async () => {
  await device.shell(`am force-stop ${appId('patient')}`);
  patient = await show(device, 'patient');
  await expect(patient).toHaveURL(`${SERVER}/en`);
  await expect(patient.getByRole('link', { name: t.nav.bookings })).toBeVisible();
  await shot(patient, 'patient-reopened');
});

test('a new nurse signs up and applies in HEACH Provider', async () => {
  provider = await freshApp(device, 'provider');
  const mobile = syntheticMobile();
  await signIn(provider, mobile);
  await expect(provider).toHaveURL(/\/en\/setup\/role$/);
  await shot(provider, 'provider-roles');
  await completeProviderSetup(provider, 'nurse', 'Synthetic App Nurse');
  await expect(provider).toHaveURL(`${SERVER}/en/provider`);
  await expect(provider.getByRole('heading', { name: t.application.title })).toBeVisible();
  await shot(provider, 'provider-application');
});
