import { LOCALES } from '@heach/i18n';
import { notFound } from 'next/navigation';
import { translatorFor } from '../../../i18n/messages';
import { serverFlags } from '../../../lib/flags';

/**
 * First launch (AC-02): the language comes first, before anything else. Each choice is written in
 * its own language and script; the proxy remembers it for the next visit to `/`.
 */
export default async function WelcomePage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  if (!serverFlags().isOn('accounts')) notFound();
  const { t } = translatorFor((await params).locale);
  return (
    <main className="page">
      <section className="flow" aria-labelledby="welcome-title">
        <div className="flow__card">
          <h1 id="welcome-title" className="flow__title">
            {t('welcome.title')}
          </h1>
          <p>{t('welcome.intro')}</p>
          <ul className="language-choices">
            {LOCALES.map((code) => (
              <li key={code}>
                <a
                  href={`/${code}`}
                  lang={code}
                  hrefLang={code}
                  className="heach-button heach-button--secondary"
                >
                  {translatorFor(code).t(`locale.${code}`)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
