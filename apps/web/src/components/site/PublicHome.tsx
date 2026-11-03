import { translatorFor } from '../../i18n/messages';
import type { SiteConfig } from '../../lib/site-config';
import { PublicServices } from './PublicServices';
import { ServiceTiles } from '../care/ServiceTiles';
import { CoverageCheck } from './CoverageCheck';
import { CareFinder } from './CareFinder';
import { ContactAction } from './ContactAction';
import { EmergencyBanner } from './EmergencyBanner';
import { HowItWorks } from './HowItWorks';
import { SiteEvidence } from './SiteEvidence';
import { FaqPreview } from './FaqPreview';

/** Public homepage. Statistics and testimonials await real, approved data (B8/B9). */
export function PublicHome({ config, locale }: Readonly<{ config: SiteConfig; locale: string }>) {
  const { t } = translatorFor(locale);
  return (
    <main className="page site-home">
      <section className="site-hero">
        <h1>{t('site.promise')}</h1>
        <p>{t('site.intro')}</p>
        <CareFinder />
        <ContactAction locale={locale} config={config} />
      </section>
      <EmergencyBanner locale={locale} />
      <section className="site-section" aria-labelledby="public-services">
        <h2 id="public-services">{t('site.need')}</h2>
        <PublicServices>
          <ServiceTiles locale={locale} t={t} showPrices />
        </PublicServices>
      </section>
      <HowItWorks locale={locale} />
      <section className="site-section">
        <h2>{t('site.verification')}</h2>
        <p>{t('site.verificationBody')}</p>
        <a className="site-link" href={`/${locale}/pages/verification`}>
          {t('site.verification')}
        </a>
      </section>
      <section className="site-section">
        <h2>{t('site.why')}</h2>
        <ul className="site-steps">
          {(['clearPrices', 'replacement', 'refund', 'odiaProviders'] as const).map((key) => (
            <li key={key}>{t(`site.${key}`)}</li>
          ))}
        </ul>
        <a className="site-link" href={`/${locale}/pages/refunds`}>
          {t('pages.refunds')}
        </a>
      </section>
      <SiteEvidence locale={locale} config={config} />
      <section className="site-section site-section--soft">
        <h2>{t('site.vault')}</h2>
        <p>{t('site.vaultBody')}</p>
        <a className="site-link" href={`/${locale}/vault`}>
          {t('nav.vault')}
        </a>
      </section>
      <section className="site-section">
        <h2>{t('site.areas')}</h2>
        <p>{t('site.areasBody')}</p>
        <CoverageCheck />
        <a className="site-link" href={`/${locale}/pages/areas`}>
          {t('site.areas')}
        </a>
      </section>
      <FaqPreview locale={locale} />
      <section className="site-section site-section--peach">
        <h2>{t('site.join')}</h2>
        <p>{t('site.joinBody')}</p>
        <a className="heach-button" href={`/${locale}/providers/join`}>
          {t('site.join')}
        </a>
      </section>
      <section className="site-section">
        <h2>{t('site.final')}</h2>
        <CareFinder />
      </section>
    </main>
  );
}
