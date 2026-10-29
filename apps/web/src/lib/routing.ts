import { isLocale, type Locale } from '@heach/i18n';
import type { Me } from '@heach/types';

export type SetupStep = 'role' | 'details' | 'consent';
export const SETUP_STEPS: readonly SetupStep[] = ['role', 'details', 'consent'];

const CARE_ROLES = new Set(['patient', 'representative']);

export function isCareRole(role: string): boolean {
  return CARE_ROLES.has(role);
}

export function isProviderRole(role: string): boolean {
  return !isCareRole(role) && role !== 'new_account';
}

/** Roles that run a lab or a clinic and manage its staff (owner decision O-1). */
export function isOrganisationOwner(role: string): boolean {
  return ['lab', 'dentist', 'dermatologist'].includes(role);
}

/**
 * A `next` path is followed only if it is a page of this app: one leading slash, a locale
 * prefix, no scheme, host, backslash or encoded slash. Anything else is dropped (no open
 * redirect). Query strings are dropped too, so nothing personal travels in them.
 */
export function safeNext(next: string | null | undefined): string | undefined {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return undefined;
  if (/[\\\s]|%2f|%5c/i.test(next)) return undefined;
  let url: URL;
  try {
    url = new URL(next, 'https://heach.invalid');
  } catch {
    return undefined;
  }
  if (url.origin !== 'https://heach.invalid') return undefined;
  const [, first = '', second = ''] = url.pathname.split('/');
  if (!isLocale(first) || ['sign-in', 'welcome'].includes(second)) return undefined;
  return url.pathname;
}

/** The same page in another language. */
export function inLocale(path: string, locale: Locale): string {
  const [, , ...rest] = path.split('/');
  return ['', locale, ...rest].join('/');
}

/**
 * Where a signed-in user belongs (new-user, returning-user and incomplete-profile routing):
 * unfinished setup first, then any consent text that is due, then the page they asked for, else
 * the home of their active role. A finished account with no role it may use (its roles are
 * deferred beyond the MVP, ADR 0015) goes to its account page, which explains and offers a role.
 * Always in the account's own language.
 */
export function destinationFor(me: Me, next?: string): string {
  const locale = me.locale;
  if (!me.setup.complete) return `/${locale}/setup/${me.setup.nextStep ?? 'role'}`;
  if (me.consentsDue.length > 0) return `/${locale}/consent`;
  if (me.activeRole === 'new_account') return `/${locale}/account`;
  const asked = safeNext(next);
  if (asked && allowedFor(me.activeRole, asked)) return inLocale(asked, locale);
  return isProviderRole(me.activeRole) ? `/${locale}/provider` : `/${locale}`;
}

/** Pages a role may open; the API enforces the same on every request. */
function allowedFor(role: string, path: string): boolean {
  const section = path.split('/')[2] ?? '';
  if (section === 'provider') return isProviderRole(role);
  if (section === 'people') return isCareRole(role);
  if (section === 'team') return isOrganisationOwner(role);
  return section !== 'setup' && section !== 'consent';
}
