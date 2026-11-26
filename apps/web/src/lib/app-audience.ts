/** Which app (Android or iPhone) a request or page is running in, if any (MA-08, ADR 0016). */
export type AppAudience = 'patient' | 'provider';

/** The apps add `HeachApp/patient` or `HeachApp/provider` to the browser's user agent. */
export function appAudience(userAgent: string | null | undefined): AppAudience | undefined {
  const match = /\bHeachApp\/(patient|provider)\b/.exec(userAgent ?? '');
  return match?.[1] as AppAudience | undefined;
}

// First path segment after the language. '' is the home page.
const CARE_SECTIONS = new Set([
  '',
  'services',
  'book',
  'bookings',
  'vault',
  'people',
  'plans',
  'referral',
  'providers',
]);
const WORK_SECTIONS = new Set(['provider', 'team']);

/**
 * Whether an app offers a page (`/en/bookings`). Each app serves one side; a browser offers
 * everything. This only decides what is shown: the API authorises every request (SE-02).
 */
export function offeredInApp(audience: AppAudience | undefined, pathname: string): boolean {
  if (!audience) return true;
  const [, , section = '', sub = ''] = pathname.split('/');
  const joining = section === 'providers' && sub === 'join';
  if (audience === 'provider') return joining || !CARE_SECTIONS.has(section);
  return !joining && !WORK_SECTIONS.has(section);
}

/** The first page of an app, where it sends a page it does not offer. */
export function appHome(audience: AppAudience, locale: string): string {
  return audience === 'provider' ? `/${locale}/provider` : `/${locale}`;
}

/**
 * Whether an app offers roles of a side at sign-up and "add a role": the patient app offers care
 * roles, the provider app offers provider roles, a browser offers both (MA-08).
 */
export function sideOffered(audience: AppAudience | undefined, side: 'care' | 'provider'): boolean {
  if (!audience) return true;
  return (audience === 'provider') === (side === 'provider');
}
