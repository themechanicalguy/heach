import Link from 'next/link';
import { Icon } from '@heach/ui';
import { createTranslator, messagesFor, formatPaise } from '@heach/i18n';
import type { T } from '../../i18n/messages';
import { StartingPrice } from '../site/PublicServices';
import { SERVICES } from './services';

/** The four services as large tiles on the home screen (SD-01). Server rendered. */
export function ServiceTiles({
  locale,
  t,
  prices,
  showPrices = false,
}: Readonly<{
  locale: string;
  t: T;
  prices?: readonly { service: string; feePaise: number }[];
  showPrices?: boolean;
}>) {
  const odia = createTranslator(messagesFor('or'), 'or');
  return (
    <ul className="service-tiles">
      {SERVICES.map((service) => {
        const price = prices?.find((entry) => entry.service === service);
        return (
          <li key={service}>
            <Link className="service-tile" href={`/${locale}/services/${service}`}>
              <span className="service-tile__icon">
                <Icon name={service === 'nursing' ? 'nurse' : service} size={32} />
              </span>
              <strong className="bilingual">
                <span lang="or">{odia(`services.${service}`)}</span>
                {locale !== 'or' && (
                  <span lang={locale} className="bilingual__secondary">
                    {t(`services.${service}`)}
                  </span>
                )}
              </strong>
              <span>{t(`servicesHint.${service}`)}</span>
              {showPrices && <StartingPrice service={service} />}
              {prices && (
                <span className="flow__muted">
                  {price
                    ? t('site.from', { fee: formatPaise(price.feePaise) })
                    : t('site.pricePending')}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
