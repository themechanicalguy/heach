import { translatorFor } from '../../i18n/messages';

export function FaqPreview({ locale }: Readonly<{ locale: string }>) {
  const { t } = translatorFor(locale);
  return (
    <section className="site-section" aria-labelledby="faq-preview">
      <h2 id="faq-preview">{t('site.faq')}</h2>
      {(['0', '1', '2', '3', '4', '5'] as const).map((index) => (
        <details key={index}>
          <summary>{t(`siteFaq.${index}.question`)}</summary>
          <p>{t(`siteFaq.${index}.answer`)}</p>
        </details>
      ))}
      <a className="site-link" href={`/${locale}/pages/faq`}>
        {t('site.faq')}
      </a>
    </section>
  );
}
