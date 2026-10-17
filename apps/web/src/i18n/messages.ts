import {
  createTranslator,
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
  messagesFor,
  type Messages,
  type Translator,
} from '@heach/i18n';

export type T = Translator<Messages>;

/** The translator for a route's locale; unknown locales fall back to the default. */
export function translatorFor(locale: string): { locale: Locale; t: T } {
  const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return { locale: resolved, t: createTranslator(messagesFor(resolved), resolved) };
}
