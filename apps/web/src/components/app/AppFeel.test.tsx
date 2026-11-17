import { act, fireEvent, render, screen } from '@testing-library/react';
import { CATALOGUES } from '@heach/i18n';
import { I18nProvider } from '../../lib/i18n-context';
import { AppFeel } from './AppFeel';

const route = vi.hoisted(() => ({ pathname: '/en' }));

vi.mock('next/navigation', () => ({
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

const page = () => (
  <I18nProvider locale="en" messages={CATALOGUES.en}>
    <AppFeel />
  </I18nProvider>
);

/** A link as a page would have it; the test stands in for the router, so the tap goes nowhere. */
function tapLink(href: string): void {
  const link = document.createElement('a');
  link.setAttribute('href', href);
  link.addEventListener('click', (event) => {
    event.preventDefault();
  });
  document.body.append(link);
  fireEvent.click(link);
  link.remove();
}

beforeEach(() => {
  route.pathname = '/en';
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('lifts the launch screen once the page is rendered (MA-09)', () => {
  const nativePromise = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('Capacitor', { nativePromise });
  render(page());
  expect(nativePromise).toHaveBeenCalledWith('SplashScreen', 'hide', {});
});

it('shows progress from a tap on a link until the next page arrives (MA-09)', () => {
  const view = render(page());
  tapLink('#help');
  expect(screen.queryByRole('progressbar')).toBeNull();
  tapLink('/en/next-page');
  expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeTruthy();
  route.pathname = '/en/next-page';
  view.rerender(page());
  expect(screen.queryByRole('progressbar')).toBeNull();
});

it('stops showing progress for a page that never arrives', () => {
  vi.useFakeTimers();
  render(page());
  tapLink('/en/next-page');
  act(() => {
    vi.advanceTimersByTime(15_000);
  });
  expect(screen.queryByRole('progressbar')).toBeNull();
});
