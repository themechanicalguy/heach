import { CATALOGUES, LOCALES, type Locale } from '@heach/i18n';
import { expect, test, type Page } from './test';
import { expectAccessible } from './accessibility';

async function expectFooterTargets(page: Page) {
  const targets = await page.locator('footer a').evaluateAll((nodes) =>
    nodes
      .filter((node) => node.getClientRects().length > 0)
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
  );
  expect(targets.every((target) => target.width >= 48 && target.height >= 48)).toBe(true);
}

/**
 * G01/G02: a one-row header, the first service tiles on the first screen above the bottom
 * navigation, and on desktop the next booking, emergency and help in the side column.
 */
async function expectHomeHierarchy(page: Page, t: (typeof CATALOGUES)[Locale]) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  const viewport = page.viewportSize();
  const header = await page.getByRole('banner').boundingBox();
  const wide = (viewport?.width ?? 0) >= 1024;
  const phone = (viewport?.width ?? 0) < 600;
  if (phone || wide) expect(header && header.height <= 72).toBe(true);
  const bell = page.getByRole('banner').getByRole('link', { name: t.nav.notifications });
  await expect(bell).toBeVisible();
  const tile = await page.locator('main .service-tile').first().boundingBox();
  const navTop = phone ? (viewport?.height ?? 0) - 76 : (viewport?.height ?? 0);
  expect(tile && tile.y + 48 < navTop).toBe(true);
  if (!wide) return;
  const side = page.locator('.patient-home-side');
  const services = await page.locator('.service-tiles').boundingBox();
  const sideBox = await side.boundingBox();
  expect(sideBox && services && sideBox.x > services.x + services.width).toBe(true);
  await expect(side.locator('.next-booking')).toBeVisible();
}

/** G05: one peach emergency card with its heading, explanation and a Call 108 action. */
async function expectEmergencyCard(page: Page, t: (typeof CATALOGUES)[Locale]) {
  const card = page.getByRole('region', { name: t.site.emergencyTitle });
  await expect(card).toContainText(t.site.emergencyBody);
  const call = card.getByRole('link', { name: t.site.emergencyCall });
  await expect(call).toBeVisible();
  await expect(call).toHaveAttribute('href', 'tel:108');
  const box = await call.boundingBox();
  expect(box && box.height >= 48).toBe(true);
}

/** Text zoom and pseudo-localization exercise the actual responsive layout, not a screenshot alone. */
async function expectResilientLayout(page: Page) {
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  const zoom = await page.evaluate(() => ({
    fits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    width: document.documentElement.clientWidth,
    overflow: Array.from(document.body.querySelectorAll('*'))
      .map((node) => ({
        tag: node.tagName,
        css: node.getAttribute('class') ?? '',
        right: node.getBoundingClientRect().right,
        width: node.getBoundingClientRect().width,
      }))
      .filter((node) => node.right > document.documentElement.clientWidth && node.width > 1)
      .slice(0, 14),
  }));
  expect(zoom.fits, JSON.stringify(zoom)).toBe(true);
  await expectFooterTargets(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (['SCRIPT', 'STYLE'].includes(node.parentElement?.tagName ?? '')) continue;
      const text = node.textContent ?? '';
      if (text.trim()) node.textContent = text + text.slice(0, Math.ceil(text.length * 0.4));
    }
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

/** Synthetic browser fixtures; real API authorization and content editing have integration tests. */
async function signedIn(page: Page, locale: Locale, role = 'patient') {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const responses: Record<string, unknown> = {
      '/auth/refresh': { accessToken: 'synthetic-browser-token' },
      '/me': {
        activeRole: role,
        locale,
        setup: { complete: true },
        consentsDue: [],
        roles: [
          {
            role,
            side: role === 'patient' ? 'care' : 'provider',
            available: true,
            applicationStatus: 'draft',
          },
        ],
      },
      '/me/linked-patients': [],
      '/me/referral': { coupons: [] },
      '/providers/00000000-0000-4000-8000-000000000011/slots': { slots: ['2099-12-01T04:30:00Z'] },
      '/providers/00000000-0000-4000-8000-000000000011': {
        id: '00000000-0000-4000-8000-000000000011',
        name: 'Synthetic Provider',
        languages: ['or', 'en'],
        identityVerified: true,
        pins: ['751001'],
        rating: null,
        ratingCount: 0,
        listings: [
          {
            listingId: '00000000-0000-4000-8000-000000000012',
            itemName: CATALOGUES[locale].services.physiotherapy,
            kind: 'visit',
            prescriptionRequired: false,
            feePaise: 50000,
            durationMinutes: 45,
          },
        ],
      },
      '/bookings': [
        {
          id: '00000000-0000-4000-8000-000000000031',
          startsAt: '2099-12-01T04:30:00Z',
          endsAt: '2099-12-01T05:30:00Z',
          status: 'confirmed',
          itemName: CATALOGUES[locale].services.physiotherapy,
          provider: { name: 'Synthetic Provider' },
        },
      ],
      '/search': [
        {
          providerId: '00000000-0000-4000-8000-000000000011',
          listingId: '00000000-0000-4000-8000-000000000012',
          name: 'Synthetic Provider',
          itemName: CATALOGUES[locale].services.physiotherapy,
          languages: ['or', 'hi'],
          feePaise: 50000,
          travelSurchargePaise: 0,
          earliestSlot: null,
        },
      ],
      '/vault/search': [
        {
          id: '00000000-0000-4000-8000-000000000041',
          title: 'Synthetic report',
          recordDate: '2026-10-22',
          recordType: 'lab_report',
          source: 'patient',
          tags: [],
          hasFile: false,
        },
      ],
      '/vault/usage': { usedBytes: 0, quotaBytes: 10485760, nearlyFull: false },
      '/vault/history': [],
      '/provider/application': {
        role: 'nurse',
        status: 'draft',
        identity: 'not_started',
        needsPayout: true,
        editable: true,
        missing: ['identity'],
        items: [],
      },
    };
    await route.fulfill({ json: responses[path] ?? [] });
  });
}

for (const locale of LOCALES) {
  const t = CATALOGUES[locale];
  test(`Public site ${locale}: emergency, four services, footer routes and axe`, async ({
    page,
    request,
  }) => {
    await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({ status: 401, json: {} }));
    await page.goto(`/${locale}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(t.site.promise);
    await expectEmergencyCard(page, t);
    await expect(page.locator('main .service-tiles a')).toHaveCount(4);
    await expect(page.getByRole('heading', { name: t.site.metricsTitle })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: t.site.reviewsTitle })).toHaveCount(0);
    await expect(page.locator('main a[href*="doctor"], main a[href*="clinic"]')).toHaveCount(0);
    const links = await page
      .getByRole('contentinfo')
      .locator('a[href^="/"]')
      .evaluateAll((nodes) => [
        ...new Set(nodes.map((node) => node.getAttribute('href')?.split('#')[0] ?? '')),
      ]);
    for (const href of links) expect((await request.get(href)).status(), href).toBe(200);
    await expectFooterTargets(page);
    await expectAccessible(page, `public home ${locale}`);
    await expectResilientLayout(page);
  });
  test(`Deferred service routes stay hidden in ${locale} (ADR 0015)`, async ({ request }) => {
    for (const service of ['doctor', 'clinic', 'dental', 'skin']) {
      expect((await request.get(`/${locale}/services/${service}`)).status()).toBe(404);
    }
  });
  test(`Contact ${locale}: routes by need, pending details marked, axe and visual snapshot`, async ({
    page,
    request,
  }) => {
    await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({ status: 401, json: {} }));
    await page.goto(`/${locale}/pages/contact`);
    await expectEmergencyCard(page, t);
    const routes = page.getByRole('region', { name: t.contact.needTitle }).getByRole('link');
    await expect(routes).toHaveCount(6);
    const targets = await routes.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('href') ?? '').filter((href) => href.startsWith('/')),
    );
    for (const href of new Set(targets)) expect((await request.get(href)).status(), href).toBe(200);
    await expect(page.getByText(t.contact.grievancePending)).toBeVisible();
    await expect(page.getByText(t.contact.dataPending)).toBeVisible();
    await expectAccessible(page, `contact ${locale}`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`contact-${locale}.png`, { fullPage: true });
    await expectResilientLayout(page);
  });
  test(`Areas ${locale}: coverage uses a private POST body and names published services`, async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({ status: 401, json: {} }));
    await page.route('**/api/v1/coverage', (route) => {
      expect(route.request().method()).toBe('POST');
      expect(route.request().postDataJSON()).toEqual({ pin: '751001' });
      return route.fulfill({ json: { served: true, services: ['nursing'] } });
    });
    await page.goto(`/${locale}/pages/areas`);
    await page.getByLabel(t.search.pin).fill('751001');
    await page.getByRole('button', { name: t.site.checkCoverage }).click();
    await expect(page.getByRole('status')).toContainText(t.site.coverageServed);
    await expect(page.getByRole('status')).toContainText(t.services.nursing);
    expect(page.url()).not.toContain('751001');
  });
  test(`Patient home ${locale}: next home visit, nearby providers, private search and visual snapshot`, async ({
    page,
  }) => {
    await signedIn(page, locale);
    await page.goto(`/${locale}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(t.site.need);
    await expect(page.getByRole('link', { name: t.site.details, exact: true })).toBeVisible();
    await page.getByLabel(t.search.pin, { exact: true }).fill('751001');
    await page.getByLabel(t.search.text, { exact: true }).fill('Synthetic');
    const sent = page.waitForRequest(
      (request) => request.url().endsWith('/api/v1/search') && request.method() === 'POST',
    );
    await page.getByRole('button', { name: t.site.find, exact: true }).click();
    expect((await sent).postDataJSON()).toMatchObject({ pin: '751001', q: 'Synthetic' });
    await expect(page.getByText(t.site.servesPin)).toBeVisible();
    expect(new URL(page.url()).search).toBe('');
    await expectEmergencyCard(page, t);
    await expectHomeHierarchy(page, t);
    await expectAccessible(page, `patient home ${locale}`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`patient-home-${locale}.png`, { fullPage: true });
    await expectResilientLayout(page);
  });
  test(`Patient home ${locale}: a saved PIN loads nearby providers automatically`, async ({
    page,
  }) => {
    await signedIn(page, locale);
    await page.route('**/api/v1/me/care-pin/read', (route) =>
      route.fulfill({ json: { pin: '751001' } }),
    );
    const searched = page.waitForRequest(
      (request) => request.url().endsWith('/api/v1/search') && request.method() === 'POST',
    );
    await page.goto(`/${locale}`);
    expect((await searched).postDataJSON()).toMatchObject({
      pin: '751001',
      service: 'physiotherapy',
    });
    await expect(page.getByText(t.site.servesPin)).toBeVisible();
    await expect(page.getByLabel(t.search.pin, { exact: true })).toHaveValue('751001');
  });
  test(`Booking A ${locale}: scrolling form and desktop summary match visual snapshot`, async ({
    page,
  }) => {
    await signedIn(page, locale);
    await page.goto(
      `/${locale}/book/00000000-0000-4000-8000-000000000012?provider=00000000-0000-4000-8000-000000000011&start=2099-12-01T04%3A30%3A00Z`,
    );
    await expect(page.getByLabel(t.book.address)).toBeVisible();
    await expect(page.getByRole('heading', { name: t.site.bookingSummary })).toBeVisible();
    await expectAccessible(page, `booking ${locale}`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`booking-${locale}.png`, { fullPage: true });
    await expectResilientLayout(page);
  });
  test(`Booking review ${locale}: focuses the new step and keeps footer targets unobscured`, async ({
    page,
  }) => {
    await signedIn(page, locale);
    await page.route('**/api/v1/booking-policy', (route) =>
      route.fulfill({ json: { freeCancellationHours: 24, lateRefundPercent: 50 } }),
    );
    await page.route('**/api/v1/bookings', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({
            json: {
              id: '00000000-0000-4000-8000-000000000021',
              itemName: 'Synthetic home visit',
              fees: { feePaise: 50000, travelPaise: 0, totalPaise: 50000, advancePaise: 50000 },
              checkout: null,
            },
          })
        : route.fallback(),
    );
    await page.goto(
      `/${locale}/book/00000000-0000-4000-8000-000000000012?provider=00000000-0000-4000-8000-000000000011&start=2099-12-01T04%3A30%3A00Z`,
    );
    await page.getByLabel(t.book.address).fill('12 Synthetic Lane');
    await page.getByLabel(t.book.pin).fill('751001');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.getByRole('button', { name: t.book.continue }).click();
    const review = page.getByRole('region', { name: t.book.reviewTitle });
    await expect(review).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expectAccessible(page, `check and pay ${locale}`);
    await expectFooterTargets(page);
  });
  test(`Records A ${locale}: timeline and desktop profile match visual snapshot`, async ({
    page,
  }) => {
    await signedIn(page, locale);
    await page.goto(`/${locale}/vault`);
    await expect(page.getByText('Synthetic report').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: t.vault.historyTitle })).toBeVisible();
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      const table = page.locator('.vault-layout .heach-table-wrap');
      expect(await table.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
    }
    await expectAccessible(page, `records ${locale}`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`records-${locale}.png`, { fullPage: true });
    await expectResilientLayout(page);
  });
  test(`Onboarding A ${locale}: one step and desktop progress match visual snapshot`, async ({
    page,
  }) => {
    await signedIn(page, locale, 'nurse');
    await page.goto(`/${locale}/provider`);
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    // G16: the heading focused after load shows the peach marker, never the browser's blue ring.
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toBeFocused();
    const focus = await title.evaluate((node) => {
      const style = getComputedStyle(node);
      return { outlineStyle: style.outlineStyle, boxShadow: style.boxShadow };
    });
    expect(focus.outlineStyle).toBe('none');
    expect(focus.boxShadow).toContain('rgb(255, 180, 143)');
    await expectAccessible(page, `onboarding ${locale}`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`onboarding-${locale}.png`, { fullPage: true });
    await page.getByRole('button', { name: t.setup.continue, exact: true }).click();
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    await expect(page.getByRole('button', { name: t.application.verifyIdentity })).toHaveCount(0);
    await expectResilientLayout(page);
  });
}
