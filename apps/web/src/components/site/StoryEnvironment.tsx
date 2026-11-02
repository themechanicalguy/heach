import type { ReactNode } from 'react';
import { CATALOGUES, type Locale } from '@heach/i18n';
import { AccountProvider } from '../../lib/account';
import { CareSearchProvider } from '../../lib/care-search';
import { I18nProvider } from '../../lib/i18n-context';
import { SessionProvider } from '../../lib/session';

/** Storybook only: shared app providers; no real account or patient data. */
export function StoryEnvironment({
  children,
  locale = 'en',
}: Readonly<{ children: ReactNode; locale?: Locale }>) {
  return (
    <I18nProvider locale={locale} messages={CATALOGUES[locale]}>
      <SessionProvider>
        <AccountProvider enabled={false}>
          <CareSearchProvider>{children}</CareSearchProvider>
        </AccountProvider>
      </SessionProvider>
    </I18nProvider>
  );
}
