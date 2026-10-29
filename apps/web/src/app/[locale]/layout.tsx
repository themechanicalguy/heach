import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { isLocale, LOCALES } from '@heach/i18n';
import { ErrorTracking } from '../../components/ErrorTracking';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { OfflineStatus } from '../../components/OfflineStatus';
import { ServiceWorker } from '../../components/ServiceWorker';
import { ShellNav } from '../../components/ShellNav';
import { WebVitals } from '../../components/WebVitals';
import { AccountProvider } from '../../lib/account';
import { serverFlags } from '../../lib/flags';
import { I18nProvider } from '../../lib/i18n-context';
import { SessionProvider } from '../../lib/session';
import { fontClassNames } from '../fonts';
import { translatorFor } from '../../i18n/messages';
import '@heach/ui/ui.css';
import '../globals.css';

interface Props {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

// Pages render per request so each gets a fresh CSP nonce (SO-05.1).
export const dynamic = 'force-dynamic';

export function generateStaticParams(): { locale: string }[] {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const { t } = translatorFor((await params).locale);
  return { title: t('app.name'), description: t('home.title'), manifest: '/manifest.webmanifest' };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1f4e79',
};

export default async function LocaleLayout({ children, params }: Readonly<Props>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { t } = translatorFor(locale);
  const flags = serverFlags();
  const accounts = flags.isOn('accounts');
  return (
    <html lang={locale} className={fontClassNames}>
      <body>
        <I18nProvider locale={locale}>
          <SessionProvider>
            <AccountProvider enabled={accounts}>
              <header className="shell-header">
                <a href={`/${locale}`} className="shell-header__name">
                  {t('app.name')}
                </a>
                <ShellNav accounts={accounts} sample={flags.isOn('sample-patient-note')} />
                <LanguageSwitch />
              </header>
              <OfflineStatus />
              {children}
              <ErrorTracking />
            </AccountProvider>
          </SessionProvider>
          <ServiceWorker />
          <WebVitals />
        </I18nProvider>
      </body>
    </html>
  );
}
