import { Button, Notice } from '@heach/ui';
import Link from 'next/link';
import { useI18n } from '../../lib/i18n-context';
import { useLocation } from '../../lib/location';
import type { Service } from '../care/services';

interface Props {
  pin: string;
  service: Service;
  onContinue: () => void;
}

/** The answer to "do you visit me?", announced as soon as it is known. */
export function LocationResult({ pin, service, onContinue }: Readonly<Props>) {
  const { locale, t } = useI18n();
  const { status, checkedPin, served } = useLocation();
  const values = { pin, service: t(`services.${service}`) };
  if (status === 'error' && checkedPin === pin) {
    return (
      <Notice tone="danger" live>
        {t('location.error')}
      </Notice>
    );
  }
  if (status !== 'ready' || checkedPin !== pin) {
    return (
      <Notice live>
        <span aria-busy="true">{t('location.checking')}</span>
      </Notice>
    );
  }
  if (served.includes(service)) {
    return (
      <div className="location-result">
        <Notice tone="success" live>
          <strong>{t('location.served', values)}</strong> {t('location.servedHint')}
        </Notice>
        <Button onClick={onContinue}>{t('location.continue')}</Button>
      </div>
    );
  }
  return (
    <div className="location-result">
      <Notice tone="warning" live>
        <strong>{t('location.unserved', values)}</strong> {t('location.unservedHint')}
      </Notice>
      <div className="location-actions">
        <Button className="heach-button--secondary" onClick={onContinue}>
          {t('location.continueAnyway')}
        </Button>
        <Link href={`/${locale}/pages/contact`}>{t('location.help')}</Link>
      </div>
    </div>
  );
}
