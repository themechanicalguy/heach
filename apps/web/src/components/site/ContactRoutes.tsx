import { Icon, type IconName } from '@heach/ui';
import { translatorFor } from '../../i18n/messages';

type RouteKey = 'booking' | 'safety' | 'refund' | 'provider' | 'data' | 'other';

/**
 * Each need goes where it can be solved. Booking, safety and refund issues are raised from the
 * signed-in booking (RF-03), so no health details travel through email or a public form.
 */
const ROUTES: readonly (readonly [RouteKey, string, IconName])[] = [
  ['booking', '/bookings', 'calendar'],
  ['safety', '/bookings', 'shield'],
  ['refund', '/pages/refunds', 'wallet'],
  ['provider', '/provider', 'user'],
  ['data', '/account', 'lock'],
  ['other', '#contact-channels', 'message'],
];

export function ContactRoutes({ locale }: Readonly<{ locale: string }>) {
  const { t } = translatorFor(locale);
  return (
    <section className="site-section contact-routes" aria-labelledby="contact-need">
      <h2 id="contact-need">{t('contact.needTitle')}</h2>
      <ul>
        {ROUTES.map(([key, path, icon]) => (
          <li key={key}>
            <a href={path.startsWith('#') ? path : `/${locale}${path}`}>
              <span className="contact-routes__icon">
                <Icon name={icon} size={22} />
              </span>
              <span>
                <strong>{t(`contact.routes.${key}.title`)}</strong>{' '}
                <span className="contact-routes__body">{t(`contact.routes.${key}.body`)}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
