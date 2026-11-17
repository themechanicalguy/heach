import { leavesPage, showPage, successTick } from './app-feel';

const HERE = 'https://heach.test/en/bookings?tab=open';
const tap = (href: string | undefined, elsewhere = false) => ({ href, elsewhere });

describe('leavesPage', () => {
  it('is true for another page or another query of this app', () => {
    expect(leavesPage(tap('/en/vault'), HERE)).toBe(true);
    expect(leavesPage(tap('/en/bookings?tab=past'), HERE)).toBe(true);
  });

  it('is false for the same page, a jump within it, or a tap off any link', () => {
    expect(leavesPage(tap('/en/bookings?tab=open'), HERE)).toBe(false);
    expect(leavesPage(tap('#help'), HERE)).toBe(false);
    expect(leavesPage(tap(undefined), HERE)).toBe(false);
  });

  it('is false for a call, another site, or a link that opens elsewhere', () => {
    expect(leavesPage(tap('tel:108'), HERE)).toBe(false);
    expect(leavesPage(tap('https://example.org/en/vault'), HERE)).toBe(false);
    expect(leavesPage(tap('/en/vault', true), HERE)).toBe(false);
  });
});

describe('inside the Android app', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lifts the launch screen and ticks through the bridge', () => {
    const nativePromise = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('Capacitor', { nativePromise });
    showPage();
    successTick();
    expect(nativePromise).toHaveBeenCalledWith('SplashScreen', 'hide', {});
    expect(nativePromise).toHaveBeenCalledWith('Haptics', 'notification', { type: 'SUCCESS' });
  });

  it('does nothing in a browser, and swallows a failure in the app', async () => {
    expect(() => {
      successTick();
    }).not.toThrow();
    vi.stubGlobal('Capacitor', { nativePromise: vi.fn().mockRejectedValue(new Error('off')) });
    successTick();
    await Promise.resolve();
  });
});
