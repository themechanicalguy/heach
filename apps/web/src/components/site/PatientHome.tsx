import { translatorFor } from '../../i18n/messages';
import type { SiteConfig } from '../../lib/site-config';
import { ServiceTiles } from '../care/ServiceTiles';
import { Bilingual } from './Bilingual';
import { CareFinder } from './CareFinder';
import { ContactAction } from './ContactAction';
import { EmergencyBanner } from './EmergencyBanner';
import { NearbyProviders } from './NearbyProviders';
import { HowItWorks } from './HowItWorks';
import { NextBooking } from './NextBooking';

export function PatientHome({ config, locale }: Readonly<{ config: SiteConfig; locale: string }>) {
  const { t } = translatorFor(locale);
  return (
    <main className="page site-home">
      <section className="site-hero">
        <h1>
          <Bilingual locale={locale} message="site.need" />
        </h1>
        <CareFinder textSearch stayOnHome />
      </section>
      <div className="patient-home-grid">
        <div>
          <NextBooking />
          <ServiceTiles locale={locale} t={t} />
          <a className="service-tile site-records" href={`/${locale}/vault`}>
            <Bilingual locale={locale} message="vault.title" />
            <span>{t('site.vaultBody')}</span>
          </a>
        </div>
        <aside className="patient-home-help">
          <EmergencyBanner locale={locale} />
          <h2>{t('site.help')}</h2>
          <ContactAction locale={locale} config={config} />
        </aside>
      </div>
      <NearbyProviders />
      <HowItWorks locale={locale} />
    </main>
  );
}
