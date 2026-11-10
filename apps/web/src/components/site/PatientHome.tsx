import { translatorFor } from '../../i18n/messages';
import type { SiteConfig } from '../../lib/site-config';
import { ServiceTiles } from '../care/ServiceTiles';
import { CareFinder } from './CareFinder';
import { EmergencyBanner } from './EmergencyBanner';
import { NearbyProviders } from './NearbyProviders';
import { NextBooking } from './NextBooking';
import { SupportCard } from './SupportCard';

/**
 * Signed-in patient home (G02): service-first on phones, with a compact search above the tiles;
 * from desktop width the search is one pill bar and the next booking, emergency and help cards
 * form the companion column (desktop home board). How it works stays on the signed-out home.
 */
export function PatientHome({ config, locale }: Readonly<{ config: SiteConfig; locale: string }>) {
  const { t } = translatorFor(locale);
  return (
    <main className="page page--app patient-home">
      <div className="patient-home-grid">
        <div className="patient-home-main">
          <h1 className="page-title">{t('site.need')}</h1>
          <CareFinder textSearch stayOnHome compact />
          <ServiceTiles locale={locale} t={t} records />
          <NearbyProviders onlyAfterSearch />
        </div>
        <div className="patient-home-side">
          <NextBooking />
          <EmergencyBanner locale={locale} />
          <SupportCard locale={locale} config={config} />
        </div>
      </div>
    </main>
  );
}
