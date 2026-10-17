'use client';

import { createTranslator, type Locale, messagesFor } from '@heach/i18n';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { T } from '../i18n/messages';

const I18nContext = createContext<{ locale: Locale; t: T } | undefined>(undefined);

/** Gives client components the translator for the route's locale. */
export function I18nProvider({
  locale,
  children,
}: Readonly<{ locale: Locale; children: ReactNode }>) {
  const value = useMemo(
    () => ({ locale, t: createTranslator(messagesFor(locale), locale) }),
    [locale],
  );
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): { locale: Locale; t: T } {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n outside I18nProvider');
  return value;
}
