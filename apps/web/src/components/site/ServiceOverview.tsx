import type { ServicePrice } from '@heach/types';

import { formatPaise } from '@heach/i18n';
import type { Service } from '../care/services';
import { translatorFor } from '../../i18n/messages';
import { Bilingual } from './Bilingual';
import { EmergencyBanner } from './EmergencyBanner';

export function ServiceOverview({
  service,
  accounts,
  locale,
  prices = [],
}: Readonly<{ service: Service; accounts: boolean; locale: string; prices?: ServicePrice[] }>) {
  const { t } = translatorFor(locale);
  const price = prices.find((row) => row.service === service);
  return (
    <>
      <section className="site-hero">
        <h1>
          <Bilingual locale={locale} message={`services.${service}`} />
        </h1>
        <p>{t(`servicesHint.${service}`)}</p>
        <a className="heach-button" href={accounts ? '#find-care' : `/${locale}/pages/contact`}>
          {t('site.book')}
        </a>
      </section>
      <section className="site-section">
        <h2>{t('site.included')}</h2>
        <p>{t(`serviceDetails.${service}.included`)}</p>
        <h2>{t('site.qualifications')}</h2>
        <p>{t(`serviceDetails.${service}.qualifications`)}</p>
        <h2>{t('site.prices')}</h2>
        <p>
          {price ? t('site.from', { fee: formatPaise(price.feePaise) }) : t('site.pricePending')}
        </p>
        <p>{t('site.clearPrices')}</p>
      </section>
      <EmergencyBanner locale={locale} />
      <section className="site-section" aria-labelledby="service-faq">
        <h2 id="service-faq">{t('site.faq')}</h2>
        {(['0', '1'] as const).map((index) => (
          <details key={index}>
            <summary>{t(`serviceDetails.${service}.faq.${index}.question`)}</summary>
            <p>{t(`serviceDetails.${service}.faq.${index}.answer`)}</p>
          </details>
        ))}
      </section>
    </>
  );
}
