import { Button } from '@heach/ui';
import { ServiceTiles } from '../../components/care/ServiceTiles';
import { translatorFor } from '../../i18n/messages';
import { serverFlags } from '../../lib/flags';

export default async function HomePage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale, t } = translatorFor((await params).locale);
  return (
    <main className="page">
      <h1>{t('home.title')}</h1>
      {serverFlags().isOn('accounts') ? (
        <ServiceTiles locale={locale} t={t} />
      ) : (
        <Button>{t('home.findCare')}</Button>
      )}
    </main>
  );
}
