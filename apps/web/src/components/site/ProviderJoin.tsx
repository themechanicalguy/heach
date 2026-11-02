import { translatorFor } from '../../i18n/messages';
import { Bilingual } from './Bilingual';

export function ProviderJoin({
  accounts,
  locale,
}: Readonly<{ accounts: boolean; locale: string }>) {
  const { t } = translatorFor(locale);
  return (
    <main className="page site-home">
      <section className="site-hero">
        <h1>
          <Bilingual locale={locale} message="site.join" />
        </h1>
        <p>{t('site.joinBody')}</p>
        <a className="heach-button" href={`/${locale}/${accounts ? 'sign-in' : 'pages/contact'}`}>
          {t('site.signUp')}
        </a>
      </section>
      <section className="site-section">
        <h2>{t('site.documents')}</h2>
        <p>{t('site.documentsBody')}</p>
      </section>
      <section className="site-section">
        <h2>{t('site.verification')}</h2>
        <p>{t('site.verificationBody')}</p>
      </section>
      <section className="site-section">
        <h2>{t('site.payouts')}</h2>
        <p>{t('site.payoutsBody')}</p>
        <a className="site-link" href={`/${locale}/pages/provider-agreement`}>
          {t('sitePages.provider-agreement.title')}
        </a>
      </section>
    </main>
  );
}
