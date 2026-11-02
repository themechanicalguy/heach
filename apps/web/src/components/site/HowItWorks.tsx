import { translatorFor } from '../../i18n/messages';

export function HowItWorks({ locale }: Readonly<{ locale: string }>) {
  const { t } = translatorFor(locale);
  return (
    <section className="site-section" id="how-it-works">
      <h2>{t('site.how')}</h2>
      <ol className="site-steps">
        {(['choose', 'providerSlot', 'pay', 'careRate'] as const).map((key) => (
          <li key={key}>{t(`site.${key}`)}</li>
        ))}
      </ol>
    </section>
  );
}
