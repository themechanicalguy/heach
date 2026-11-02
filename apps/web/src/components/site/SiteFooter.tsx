import type { T } from '../../i18n/messages';
import { translatorFor } from '../../i18n/messages';
import type { SiteConfig } from '../../lib/site-config';
import { SERVICES } from '../care/services';
import { LanguageSwitch } from '../LanguageSwitch';
import { ContactAction } from './ContactAction';

type FooterLink = readonly [string, Parameters<T>[0]];
const PATIENT_LINKS: FooterLink[] = [
  ['#how-it-works', 'site.how'],
  ['/pages/areas', 'site.areas'],
  ['/pages/faq', 'site.faq'],
  ['/pages/contact', 'site.helpLink'],
];
const PROVIDER_LINKS: FooterLink[] = [
  ['/providers/join', 'site.join'],
  ['/pages/provider-agreement', 'sitePages.provider-agreement.title'],
];
const LEGAL_LINKS: FooterLink[] = [
  ['/pages/about', 'sitePages.about.title'],
  ['/pages/contact', 'sitePages.contact.title'],
  ['/pages/terms', 'pages.terms'],
  ['/pages/privacy', 'pages.privacy'],
  ['/pages/refunds', 'pages.refunds'],
  ['/pages/patient-rights', 'sitePages.patient-rights.title'],
  ['/pages/grievance', 'sitePages.grievance.title'],
];

function FooterColumn({
  title,
  links,
  locale,
}: Readonly<{ title: string; links: FooterLink[]; locale: string }>) {
  const { t } = translatorFor(locale);
  return (
    <div>
      <h2>{title}</h2>
      <ul>
        {links.map(([path, key]) => (
          <li key={path}>
            <a href={`/${locale}${path}`}>{t(key)}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Public footer links are available on every page, including while accounts are disabled. */
export function SiteFooter({ config, locale }: Readonly<{ config: SiteConfig; locale: string }>) {
  const { t } = translatorFor(locale);
  return (
    <footer className="site-footer">
      <div className="site-footer__columns">
        <FooterColumn
          locale={locale}
          title={t('site.services')}
          links={SERVICES.map((service) => [`/services/${service}`, `services.${service}`])}
        />
        <FooterColumn locale={locale} title={t('site.forPatients')} links={PATIENT_LINKS} />
        <FooterColumn locale={locale} title={t('site.forProviders')} links={PROVIDER_LINKS} />
        <FooterColumn locale={locale} title={t('site.company')} links={LEGAL_LINKS} />
      </div>
      <div className="site-footer__strip">
        <LanguageSwitch />
        <ContactAction locale={locale} config={config} />
        <p>
          {config.legalName && config.legalAddress
            ? `${config.legalName} · ${config.legalAddress}`
            : t('site.legalPending')}
        </p>
        {config.supportEmail && <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a>}
      </div>
    </footer>
  );
}
