'use client';

import { Button, Icon } from '@heach/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '../../lib/i18n-context';
import { isCarePage, useActiveService, useIsCareAudience, useLocation } from '../../lib/location';

/**
 * Shown for as long as the chosen service is not served at the chosen PIN. It never blocks the
 * page and cannot be dismissed: the way out is a different location or the help desk (SD-04).
 */
export function LocationBanner() {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const { status, checkedPin, served, openDialog } = useLocation();
  const service = useActiveService();
  const audience = useIsCareAudience();
  if (!audience || !isCarePage(pathname) || status !== 'ready' || served.includes(service)) {
    return null;
  }
  return (
    <section className="location-banner" aria-label={t('location.bannerLabel')}>
      <div className="location-banner__inner">
        <p className="location-banner__text" role="status">
          <Icon name="pin" size={22} />
          <span>
            <strong>
              {t('location.bannerTitle', { pin: checkedPin, service: t(`services.${service}`) })}
            </strong>{' '}
            {t('location.bannerHint')}
          </span>
        </p>
        <div className="location-banner__actions">
          <Button className="heach-button--secondary" onClick={openDialog}>
            {t('location.update')}
          </Button>
          <Link href={`/${locale}/pages/contact`}>{t('location.help')}</Link>
        </div>
      </div>
    </section>
  );
}
