import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@heach/ui';
import { formatPaise } from '@heach/i18n';
import type { T } from '../../i18n/messages';
import { StartingPrice } from '../site/PublicServices';
import { SERVICES } from './services';

function Tile({
  href,
  icon,
  title,
  hint,
  tone = 'lavender',
  children,
}: Readonly<{
  href: string;
  icon: IconName;
  title: string;
  hint: string;
  tone?: 'lavender' | 'peach';
  children?: ReactNode;
}>) {
  return (
    <li>
      <Link className="service-tile" href={href}>
        <span className={`service-tile__icon service-tile__icon--${tone}`}>
          <Icon name={icon} size={24} />
        </span>
        <span className="service-tile__text">
          <strong className="service-tile__title">{title}</strong>
          <span className="service-tile__hint">{hint}</span>
          {children}
        </span>
      </Link>
    </li>
  );
}

/**
 * The four services as white tiles with lavender icon wells (SD-01, design reference). The records
 * tile, when shown, takes the peach well so it reads as yours rather than another service (G03).
 */
export function ServiceTiles({
  locale,
  t,
  prices,
  showPrices = false,
  records = false,
}: Readonly<{
  locale: string;
  t: T;
  prices?: readonly { service: string; feePaise: number }[];
  showPrices?: boolean;
  records?: boolean;
}>) {
  return (
    <ul className="service-tiles">
      {SERVICES.map((service) => {
        const price = prices?.find((entry) => entry.service === service);
        return (
          <Tile
            key={service}
            href={`/${locale}/services/${service}`}
            icon={service === 'nursing' ? 'nurse' : service}
            title={t(`services.${service}`)}
            hint={t(`servicesHint.${service}`)}
          >
            {showPrices && <StartingPrice service={service} />}
            {prices && (
              <span className="service-tile__hint">
                {price
                  ? t('site.from', { fee: formatPaise(price.feePaise) })
                  : t('site.pricePending')}
              </span>
            )}
          </Tile>
        );
      })}
      {records && (
        <Tile
          href={`/${locale}/vault`}
          icon="file"
          title={t('vault.title')}
          hint={t('site.recordsHint')}
          tone="peach"
        />
      )}
    </ul>
  );
}
