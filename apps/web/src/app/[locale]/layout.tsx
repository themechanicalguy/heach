import { colors } from '@heach/ui';
import Link from 'next/link';
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { isLocale, LOCALES } from '@heach/i18n';
import { ErrorTracking } from '../../components/ErrorTracking';
import { HeaderAccount } from '../../components/HeaderAccount';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { OfflineStatus } from '../../components/OfflineStatus';
import { ServiceWorker } from '../../components/ServiceWorker';
import { ShellNav } from '../../components/ShellNav';
import { WebVitals } from '../../components/WebVitals';
import { AccountProvider } from '../../lib/account';
import { serverFlags } from '../../lib/flags';
import { I18nProvider } from '../../lib/i18n-context';
import { SessionProvider } from '../../lib/session';
import { criticalFontFiles } from '../fonts';
import { translatorFor } from '../../i18n/messages';
import { CareSearchProvider } from '../../lib/care-search';
import { LocationProvider } from '../../lib/location';
import { LocationBanner } from '../../components/location/LocationBanner';
import { LocationDialog } from '../../components/location/LocationDialog';
import { HeaderCare } from '../../components/site/HeaderCare';
import { FooterSwitch } from '../../components/site/FooterSwitch';
import { AppFooter, SiteFooter } from '../../components/site/SiteFooter';
import { shellMessages } from '../../lib/client-messages';
import { siteConfig } from '../../lib/site-config';
import '@heach/ui/ui.css';
import '../fonts.css';
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
  themeColor: colors.primary,
};

export default async function LocaleLayout({ children, params }: Readonly<Props>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { t } = translatorFor(locale);
  const flags = serverFlags();
  const accounts = flags.isOn('accounts');
  return (
    <html lang={locale}>
      <head>
        {criticalFontFiles(locale).map((href, index) => (
          <link
            key={href}
            rel="preload"
            href={href}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
            fetchPriority={index === 0 ? 'high' : 'low'}
          />
        ))}
      </head>
      <body>
        <I18nProvider locale={locale} messages={shellMessages(locale)}>
          <SessionProvider>
            <AccountProvider enabled={accounts}>
              <CareSearchProvider>
                <LocationProvider>
                  <header className="shell-header">
                    <Link href={`/${locale}`} className="shell-header__name">
                      <span className="shell-header__mark" aria-hidden="true" />
                      <span className="shell-header__label">{t('app.name')}</span>
                    </Link>
                    <ShellNav accounts={accounts} sample={flags.isOn('sample-patient-note')} />
                    <div className="shell-header__actions">
                      <HeaderCare language={<LanguageSwitch />} />
                      <HeaderAccount />
                    </div>
                  </header>
                  <LocationBanner />
                  <OfflineStatus />
                  {children}
                  <FooterSwitch
                    full={<SiteFooter config={siteConfig()} locale={locale} />}
                    compact={<AppFooter config={siteConfig()} locale={locale} />}
                  />
                  <LocationDialog />
                  <ErrorTracking />
                </LocationProvider>
              </CareSearchProvider>
            </AccountProvider>
          </SessionProvider>
          <ServiceWorker />
          <WebVitals />
        </I18nProvider>
      </body>
    </html>
  );
}
