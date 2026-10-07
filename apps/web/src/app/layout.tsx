import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { t } from '../i18n/messages';
import '@heach/ui/ui.css';
import './globals.css';

export const metadata: Metadata = {
  title: t('home.title'),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
