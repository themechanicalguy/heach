import { isLocale, type Locale } from '@heach/i18n';
import { approvedEvidence, type SiteEvidence } from './site-evidence';

export interface HelplineHours {
  open: string;
  close: string;
}

/** Grievance officer details; shown only when every field the law asks for is set. */
export interface GrievanceOfficer {
  name: string;
  email: string;
  phone: string;
  acknowledgeHours: number;
  resolveDays: number;
}

/** Public operational configuration (DC: Public after owner approval). No secrets belong here. */
export interface SiteConfig extends SiteEvidence {
  helpline?: string | undefined;
  helplineHours?: HelplineHours | undefined;
  helplineLanguages?: readonly Locale[] | undefined;
  replyDays?: number | undefined;
  supportEmail?: string | undefined;
  grievance?: GrievanceOfficer | undefined;
  dataContactEmail?: string | undefined;
  legalName?: string | undefined;
  legalAddress?: string | undefined;
  cin?: string | undefined;
}

type Env = Readonly<Record<string, string | undefined>>;

/** "08:00-20:00" → hours; anything else is treated as not yet confirmed. */
export function parseHours(value: string | undefined): HelplineHours | undefined {
  const match = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/.exec(value?.trim() ?? '');
  if (!match) return undefined;
  const [, oh, om, ch, cm] = match;
  return { open: `${oh ?? ''}:${om ?? ''}`, close: `${ch ?? ''}:${cm ?? ''}` };
}

/** "or,en,hi" → supported locales only, in the given order, without repeats. */
export function parseLanguages(value: string | undefined): readonly Locale[] | undefined {
  const locales = [...new Set((value ?? '').split(',').map((part) => part.trim()))].filter(
    isLocale,
  );
  return locales.length > 0 ? locales : undefined;
}

/** A whole number from 1 to max; anything else is treated as not yet confirmed. */
export function parseCount(value: string | undefined, max: number): number | undefined {
  if (!/^\d+$/.test(value?.trim() ?? '')) return undefined;
  const count = Number(value);
  return count >= 1 && count <= max ? count : undefined;
}

export function grievanceOfficer(env: Env): GrievanceOfficer | undefined {
  const name = env.SITE_GRIEVANCE_NAME?.trim();
  const email = env.SITE_GRIEVANCE_EMAIL?.trim();
  const phone = env.SITE_GRIEVANCE_PHONE?.trim();
  const acknowledgeHours = parseCount(env.SITE_GRIEVANCE_ACK_HOURS, 168);
  const resolveDays = parseCount(env.SITE_GRIEVANCE_RESOLVE_DAYS, 90);
  if (!name || !email || !phone || !acknowledgeHours || !resolveDays) return undefined;
  return { name, email, phone, acknowledgeHours, resolveDays };
}

/** Only these explicitly public values cross the server/client boundary. */
export function siteConfig(env: Env = process.env): SiteConfig {
  return {
    ...approvedEvidence(env.SITE_METRICS, env.SITE_REVIEWS),
    helpline: env.SITE_HELPLINE,
    helplineHours: parseHours(env.SITE_HELPLINE_HOURS),
    helplineLanguages: parseLanguages(env.SITE_HELPLINE_LANGUAGES),
    replyDays: parseCount(env.SITE_REPLY_DAYS, 30),
    supportEmail: env.SITE_SUPPORT_EMAIL,
    grievance: grievanceOfficer(env),
    dataContactEmail: env.SITE_DATA_CONTACT_EMAIL,
    legalName: env.SITE_LEGAL_NAME,
    legalAddress: env.SITE_LEGAL_ADDRESS,
    cin: env.SITE_CIN,
  };
}
