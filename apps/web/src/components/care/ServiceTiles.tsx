import Link from 'next/link';
import type { T } from '../../i18n/messages';
import { SERVICES } from './services';

/** The four services as large tiles on the home screen (SD-01). Server rendered. */
export function ServiceTiles({ locale, t }: Readonly<{ locale: string; t: T }>) {
  return (
    <ul className="service-tiles">
      {SERVICES.map((service) => (
        <li key={service}>
          <Link className="service-tile" href={`/${locale}/services/${service}`}>
            <strong>{t(`services.${service}`)}</strong>
            <span>{t(`servicesHint.${service}`)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
