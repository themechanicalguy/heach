'use client';

import { LOCALES } from '@heach/i18n';
import { usePathname } from 'next/navigation';
import { useI18n } from '../lib/i18n-context';

/** Links to the same page in each language; each link is labelled in its own language. */
export function LanguageSwitch() {
  const { locale, t } = useI18n();
  const rest = usePathname().split('/').slice(2).join('/');
  const suffix = rest ? `/${rest}` : '';
  return (
    <nav aria-label={t('locale.label')} className="language-switch">
      {LOCALES.map((code) => (
        <a
          key={code}
          href={`/${code}${suffix}`}
          lang={code}
          hrefLang={code}
          aria-current={code === locale ? 'true' : undefined}
        >
          {t(`locale.${code}`)}
        </a>
      ))}
    </nav>
  );
}
