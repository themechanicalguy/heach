import { callAppQuietly } from './app-bridge';

/** Lifts the app's launch screen once the page can be used (MA-09). */
export function showPage(): void {
  callAppQuietly('SplashScreen', 'hide');
}

/** A short tick in the hand when something the user asked for has gone through (MA-09). */
export function successTick(): void {
  callAppQuietly('Haptics', 'notification', { type: 'SUCCESS' });
}

export interface LinkTap {
  /** The link's address as written; undefined when the tap was not on a link. */
  href: string | undefined;
  /** Opens elsewhere: a new tab, a download, or a tap with a modifier key. */
  elsewhere: boolean;
}

/** Whether a tap on a link starts loading another page of this app. */
export function leavesPage(tap: LinkTap, here: string): boolean {
  if (tap.href === undefined || tap.elsewhere) return false;
  const from = new URL(here);
  const to = new URL(tap.href, here);
  if (to.origin !== from.origin) return false;
  return to.pathname !== from.pathname || to.search !== from.search;
}
