import { expect, test } from '@playwright/test';

const GLITCHTIP = process.env.GLITCHTIP_URL ?? '';
const TOKEN = process.env.GLITCHTIP_AUTH_TOKEN ?? '';
const ORG = process.env.GLITCHTIP_ORG ?? 'heach';
const PROJECT = process.env.GLITCHTIP_PROJECT ?? 'web';
const RELEASE = process.env.NEXT_PUBLIC_BUILD_VERSION ?? '';

interface Frame {
  filename?: string;
  absPath?: string;
}
interface GlitchTipEvent {
  release?: string | { version?: string };
  user?: unknown;
  tags: { key: string; value: string }[];
  entries: { type: string; data: { values?: { stacktrace?: { frames: Frame[] } }[] } }[];
}

async function glitchtip<T>(path: string): Promise<T> {
  const response = await fetch(`${GLITCHTIP}/api/0/${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  expect(response.ok).toBe(true);
  return (await response.json()) as T;
}

async function latestEvent(since: number): Promise<GlitchTipEvent | undefined> {
  const issues = await glitchtip<{ id: string; title: string; lastSeen: string }[]>(
    `projects/${ORG}/${PROJECT}/issues/?query=is:unresolved`,
  );
  const fresh = issues.find(
    (issue) => issue.title.includes('LM-03.1 synthetic') && Date.parse(issue.lastSeen) >= since,
  );
  return fresh ? glitchtip<GlitchTipEvent>(`issues/${fresh.id}/events/latest/`) : undefined;
}

/**
 * LM-03.1 manual record, automated: a synthetic front-end error thrown inside the app's own code
 * reaches GlitchTip with the release and role tags, source-mapped frames and no user identity.
 * Needs a production build with a DSN, uploaded source maps and the local GlitchTip
 * (docs/runbooks/error-tracking.md); runs when E2E_GLITCHTIP=1.
 */
test.describe('Front-end error tracking', () => {
  test.skip(!process.env.E2E_GLITCHTIP, 'Needs local GlitchTip and a DSN build (E2E_GLITCHTIP=1)');

  test('LM-03.1 a thrown error is recorded with source map, release and role only', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One record is enough');
    test.setTimeout(90_000);
    const since = Date.now() - 1000;
    // Synthetic fault: once error tracking has loaded, reading navigator.onLine throws, so the
    // app's own OfflineStatus component fails while rendering after an `offline` event.
    await page.addInitScript(() => {
      const onLine = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
      Object.defineProperty(Navigator.prototype, 'onLine', {
        configurable: true,
        get(this: Navigator) {
          if ((window as { lm03?: boolean }).lm03) throw new Error('LM-03.1 synthetic error');
          return onLine?.get?.call(this) as boolean;
        },
      });
    });
    const trackingReady = page.waitForRequest((request) => request.url().startsWith(GLITCHTIP));
    await page.goto('/en');
    await trackingReady;
    await page.evaluate(() => {
      (window as { lm03?: boolean }).lm03 = true;
      window.dispatchEvent(new Event('offline'));
    });
    let event: GlitchTipEvent | undefined;
    await expect
      .poll(async () => (event = await latestEvent(since)), { timeout: 60_000, intervals: [2000] })
      .toBeTruthy();
    if (!event) return;
    const tags = Object.fromEntries(event.tags.map((tag) => [tag.key, tag.value]));
    const release = typeof event.release === 'string' ? event.release : event.release?.version;
    expect(release ?? tags.release).toBe(RELEASE);
    expect(tags.role).toBe('anonymous');
    expect(event.user ?? null).toBeNull();
    const frames = event.entries
      .filter((entry) => entry.type === 'exception')
      .flatMap((entry) => entry.data.values ?? [])
      .flatMap((value) => value.stacktrace?.frames ?? []);
    // Source-mapped: frames name the original TypeScript file, not a minified chunk.
    expect(
      frames.some((frame) =>
        (frame.filename ?? '').endsWith('apps/web/src/components/OfflineStatus.tsx'),
      ),
    ).toBe(true);
  });
});
