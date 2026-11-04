import { siteConfig } from '../../lib/site-config';

/** Synthetic, clearly fake contact values for stories and tests; never real operational details. */
export const SYNTHETIC_CONTACT = siteConfig({
  SITE_HELPLINE: '1800-000-0000',
  SITE_HELPLINE_HOURS: '08:00-20:00',
  SITE_HELPLINE_LANGUAGES: 'or,en,hi',
  SITE_REPLY_DAYS: '1',
  SITE_SUPPORT_EMAIL: 'support@heach.example',
  SITE_GRIEVANCE_NAME: 'Synthetic Officer',
  SITE_GRIEVANCE_EMAIL: 'grievance@heach.example',
  SITE_GRIEVANCE_PHONE: '+910000000000',
  SITE_GRIEVANCE_ACK_HOURS: '24',
  SITE_GRIEVANCE_RESOLVE_DAYS: '15',
  SITE_DATA_CONTACT_EMAIL: 'privacy@heach.example',
  SITE_LEGAL_NAME: 'Synthetic Health Services Private Limited',
  SITE_LEGAL_ADDRESS: 'Plot 0, Example Road, Bhubaneswar 751001',
  SITE_CIN: 'U00000OD0000PTC000000',
});
