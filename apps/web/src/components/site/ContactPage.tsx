import type { SiteConfig } from '../../lib/site-config';
import { CompanyDetails, ContactChannels, DataContact, GrievanceContact } from './ContactDetails';
import { ContactRoutes } from './ContactRoutes';
import { FaqPreview } from './FaqPreview';

/**
 * The contact page below its editable intro (AD-09): route by need first, then the channels and
 * the details the IT Rules, E-Commerce Rules and DPDP Rules ask a platform to publish.
 */
export function ContactPage({ config, locale }: Readonly<{ config: SiteConfig; locale: string }>) {
  return (
    <div className="contact-page">
      <ContactRoutes locale={locale} />
      <ContactChannels config={config} locale={locale} />
      <GrievanceContact config={config} locale={locale} />
      <DataContact config={config} locale={locale} />
      <CompanyDetails config={config} locale={locale} />
      <FaqPreview locale={locale} />
    </div>
  );
}
