import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { isLocale, LOCALES } from '@heach/i18n';
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
  return { title: t('app.name'), description: t('home.title') };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1f4e79',
};

export default async function LocaleLayout({ children, params }: Readonly<Props>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} className={fontClassNames}>
      <body>{children}</body>
    </html>
  );
}
