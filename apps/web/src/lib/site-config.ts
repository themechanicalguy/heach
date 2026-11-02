import { approvedEvidence, type SiteEvidence } from './site-evidence';

/** Public operational configuration (DC: Public after owner approval). No secrets belong here. */
export interface SiteConfig extends SiteEvidence {
  helpline?: string | undefined;
  supportEmail?: string | undefined;
  legalName?: string | undefined;
  legalAddress?: string | undefined;
}

/** Only these explicitly public values cross the server/client boundary. */
export function siteConfig(): SiteConfig {
  return {
    ...approvedEvidence(process.env.SITE_METRICS, process.env.SITE_REVIEWS),
    helpline: process.env.SITE_HELPLINE,
    supportEmail: process.env.SITE_SUPPORT_EMAIL,
    legalName: process.env.SITE_LEGAL_NAME,
    legalAddress: process.env.SITE_LEGAL_ADDRESS,
  };
}
