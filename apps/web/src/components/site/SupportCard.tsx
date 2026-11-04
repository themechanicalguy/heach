import { translatorFor } from '../../i18n/messages';
import type { SiteConfig } from '../../lib/site-config';
import { ContactAction } from './ContactAction';

/** The helpline as its own card (design reference, desktop home); honest while it is pending. */
export function SupportCard({ config, locale }: Readonly<{ config: SiteConfig; locale: string }>) {
  const { t } = translatorFor(locale);
  return (
    <section className="support-card" aria-labelledby="support-card-title">
      <h2 id="support-card-title">{t('site.helpTitle')}</h2>
      <p>{t('site.helpBody')}</p>
      <ContactAction locale={locale} config={config} />
    </section>
  );
}
