import { translatorFor } from '../../i18n/messages';
import { EmergencyCard } from './EmergencyCard';

/** The emergency card on server-rendered pages (home, services, contact). */
export function EmergencyBanner({ locale }: Readonly<{ locale: string }>) {
  const { t } = translatorFor(locale);
  return (
    <EmergencyCard
      title={t('site.emergencyTitle')}
      body={t('site.emergencyBody')}
      call={t('site.emergencyCall')}
    />
  );
}
