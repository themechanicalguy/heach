import { Card } from '@heach/ui';
import { formatDate } from '@heach/i18n';
import { translatorFor } from '../../i18n/messages';
import type { SiteConfig } from '../../lib/site-config';

/** B8/B9 have no markup until approved real content exists; no synthetic marketing claims. */
export function SiteEvidence({ config, locale }: Readonly<{ config: SiteConfig; locale: string }>) {
  const { t, locale: resolved } = translatorFor(locale);
  const { metrics, reviews } = config;
  const number = (value: number) => new Intl.NumberFormat(`${locale}-IN`).format(value);
  if (!metrics && !reviews) return null;
  return (
    <>
      {metrics && (
        <section className="site-section">
          <h2>{t('site.metricsTitle')}</h2>
          <ul className="site-steps">
            <li>{t('site.providerCount', { count: number(metrics.providers) })}</li>
            <li>{t('site.visitCount', { count: number(metrics.visits) })}</li>
            <li>{t('site.cityCount', { count: number(metrics.cities) })}</li>
          </ul>
          <p>
            {t('site.asOf', {
              date: formatDate(new Date(`${metrics.asOf}T00:00:00+05:30`), resolved),
            })}
          </p>
        </section>
      )}
      {reviews && (
        <section className="site-section">
          <h2>{t('site.reviewsTitle')}</h2>
          <ul className="site-provider-grid">
            {reviews.map((review, index) => (
              <li key={String(index)}>
                <Card
                  title={t('site.reviewAttribution', {
                    name: review.firstName,
                    service: t(`services.${review.service}`),
                  })}
                >
                  <blockquote lang={review.locale}>{review.text}</blockquote>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
