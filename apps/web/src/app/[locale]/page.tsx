import { Button } from '@heach/ui';
import { translatorFor } from '../../i18n/messages';

export default async function HomePage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { t } = translatorFor((await params).locale);
  return (
    <main className="page">
      <h1>{t('home.title')}</h1>
      <Button>{t('home.findCare')}</Button>
    </main>
  );
}
