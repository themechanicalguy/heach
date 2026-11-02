import { Notice } from '@heach/ui';
import { translatorFor } from '../../i18n/messages';

/** Always visible, never dismissible. HEACH does not provide emergency care. */
export function EmergencyBanner({ locale }: Readonly<{ locale: string }>) {
  const { t } = translatorFor(locale);
  return (
    <aside className="site-emergency" aria-label={t('site.emergencyTitle')}>
      <Notice tone="warning">
        <a href="tel:108">{t('site.emergency')}</a>
      </Notice>
    </aside>
  );
}
