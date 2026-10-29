import { CATALOGUES, LOCALES } from '@heach/i18n';
import { expect, test } from '@playwright/test';

for (const locale of LOCALES) {
  test(`TS-07.1 the shell in ${locale} matches its visual baseline`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(CATALOGUES[locale].home.title);
    // The sign-in button appears once the session check ends; wait so the render is stable.
    await expect(page.getByRole('link', { name: CATALOGUES[locale].nav.signIn })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`shell-${locale}.png`, { fullPage: true });
  });
}

test('UX-03.1 the bottom navigation sits in the thumb zone at 360 px', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Phone layout only');
  await page.goto('/en');
  const nav = page.getByRole('navigation', { name: CATALOGUES.en.nav.label });
  const box = await nav.boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && box.y + box.height).toBe(viewport?.height);
  expect(box && viewport && box.y >= viewport.height * 0.75).toBe(true);
  await expect(nav).toHaveScreenshot('bottom-nav-360.png');
});

test('the navigation sits in the one top header and stays there while the page scrolls', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Phones keep it in the thumb zone (UX-03.1)');
  await page.goto('/en');
  const header = page.getByRole('banner');
  await expect(header.getByRole('navigation', { name: CATALOGUES.en.nav.label })).toBeVisible();
  await page.evaluate(() => {
    document.body.style.minHeight = '300vh';
    window.scrollTo(0, 1000);
  });
  expect((await header.boundingBox())?.y).toBe(0);
});

test('AC-02 the language pill opens the three languages and goes to the chosen one', async ({
  page,
}) => {
  await page.goto('/en');
  const languages = page.getByRole('navigation', { name: CATALOGUES.en.locale.label });
  const pill = languages.getByRole('button', { name: CATALOGUES.en.locale.en });
  await pill.click();
  await expect(pill).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(pill).toHaveAttribute('aria-expanded', 'false');
  await expect(pill).toBeFocused();
  await pill.click();
  await languages.getByRole('link', { name: CATALOGUES.hi.locale.hi }).click();
  await expect(page).toHaveURL(/\/hi$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(CATALOGUES.hi.home.title);
});

test('a signed-out visitor can sign in or sign up from the header', async ({ page }) => {
  await page.goto('/en');
  await page.getByRole('banner').getByRole('link', { name: CATALOGUES.en.nav.signIn }).click();
  await expect(page).toHaveURL(/\/en\/sign-in$/);
  await expect(
    page.getByRole('banner').getByRole('link', { name: CATALOGUES.en.nav.signIn }),
  ).toHaveCount(0);
});

test('I18N-06.1 Odia and Devanagari fonts are bundled and text 40 percent longer does not overflow', async ({
  page,
}) => {
  for (const locale of ['or', 'hi'] as const) {
    await page.goto(`/${locale}`);
    await page.evaluate(() => document.fonts.ready);
    // A loaded face, served from this origin, covers the script's block (subset by unicode-range).
    const block = locale === 'or' ? 'U+B01' : 'U+900';
    const covering = await page.evaluate(
      (start) =>
        [...document.fonts].filter((f) => f.status === 'loaded' && f.unicodeRange.includes(start))
          .length,
      block,
    );
    expect(covering).toBeGreaterThan(0);
    const fontRequests = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .filter((r) => r.name.endsWith('.woff2'))
        .map((r) => new URL(r.name).origin),
    );
    expect(new Set(fontRequests)).toEqual(new Set([new URL(page.url()).origin]));
    // Pseudo-localise: every text node grows by 40 percent.
    await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        if (text.trim()) node.textContent = text + text.slice(0, Math.ceil(text.length * 0.4));
      }
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  }
});
