import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { translatorFor } from '../i18n/messages';
import { clientMessages } from '../lib/client-messages';
import { I18nProvider } from '../lib/i18n-context';

/** Each server page supplies the namespaces used by its client islands, including on navigation. */
export async function PageMessages({
  children,
  page: selectedPage,
}: Readonly<{ children: ReactNode; page?: string }>) {
  const request = await headers();
  const { locale } = translatorFor(request.get('x-heach-locale') ?? 'or');
  const page = selectedPage ?? request.get('x-heach-page') ?? 'home';
  return (
    <I18nProvider locale={locale} messages={clientMessages(locale, page)}>
      {children}
    </I18nProvider>
  );
}
