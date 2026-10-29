'use client';

import { type Locale, LOCALES } from '@heach/i18n';
import { usePathname } from 'next/navigation';
import { useAccount } from '../lib/account';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n-context';

/**
 * Links to the same page in each language; each link is labelled in its own language. Signed in,
 * the choice is also kept on the account, so SMS and the next sign-in use it (AC-02).
 */
export function LanguageSwitch() {
  const { locale, t } = useI18n();
  const { account } = useAccount();
  const rest = usePathname().split('/').slice(2).join('/');
  const suffix = rest ? `/${rest}` : '';
  const remember = (code: Locale) => {
    if (account.state !== 'ready' || code === locale) return;
    void api('/me/locale', {
      method: 'PUT',
      body: JSON.stringify({ locale: code }),
      keepalive: true,
    }).catch(() => undefined);
  };
  return (
    <nav aria-label={t('locale.label')} className="language-switch">
      {LOCALES.map((code) => (
        <a
          key={code}
          href={`/${code}${suffix}`}
          lang={code}
          hrefLang={code}
          aria-current={code === locale ? 'true' : undefined}
          onClick={() => {
            remember(code);
          }}
        >
          {t(`locale.${code}`)}
        </a>
      ))}
    </nav>
  );
}
