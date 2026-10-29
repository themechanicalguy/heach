'use client';

import { createTranslator, type Locale, type Messages } from '@heach/i18n';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { T } from '../i18n/messages';
import { registerMessages } from './message-keys';

const I18nContext = createContext<{ locale: Locale; t: T } | undefined>(undefined);

/**
 * Gives client components the translator for the route's locale. The server layout passes only
 * that locale's catalogue, so the other languages never reach the browser bundle (PF-02).
 */
export function I18nProvider({
  locale,
  messages,
  children,
}: Readonly<{ locale: Locale; messages: Messages; children: ReactNode }>) {
  const value = useMemo(() => {
    registerMessages(messages);
    return { locale, t: createTranslator(messages, locale) };
  }, [locale, messages]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): { locale: Locale; t: T } {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n outside I18nProvider');
  return value;
}
