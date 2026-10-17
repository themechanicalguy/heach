import { DEFAULT_LOCALE, LOCALES, type Locale } from '@heach/i18n';

/** First supported language in Accept-Language, else Odia (I18N-01). */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  for (const part of (acceptLanguage ?? '').split(',')) {
    const tag = part.split(';')[0]?.trim().slice(0, 2).toLowerCase();
    const match = LOCALES.find((locale) => locale === tag);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}
