import type { SiteConfig } from '../../lib/site-config';
import { translatorFor } from '../../i18n/messages';

export function ContactAction({
  config,
  locale,
  compact = false,
}: Readonly<{ config: SiteConfig; locale: string; compact?: boolean }>) {
  const { t } = translatorFor(locale);
  return config.helpline ? (
    <a className="heach-button heach-button--secondary" href={`tel:${config.helpline}`}>
      {t('site.call')} {config.helpline}
    </a>
  ) : (
    <a className="site-contact-pending" href={`/${locale}/pages/contact`}>
      {t(compact ? 'site.helpLink' : 'site.contactPending')}
    </a>
  );
}
