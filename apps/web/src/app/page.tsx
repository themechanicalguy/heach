import { Button } from '@heach/ui';
import { t } from '../i18n/messages';

export default function HomePage() {
  return (
    <main className="page">
      <h1>{t('home.title')}</h1>
      <Button>{t('home.findCare')}</Button>
    </main>
  );
}
