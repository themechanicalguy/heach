import { Button } from '@heach/ui';
import { t } from '../i18n';

export function Dashboard() {
  return (
    <>
      <h1>{t('dashboard.title')}</h1>
      <p>{t('dashboard.placeholder')}</p>
      <Button>{t('dashboard.refresh')}</Button>
    </>
  );
}
