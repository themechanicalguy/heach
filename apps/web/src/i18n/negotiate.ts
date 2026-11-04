import { DEFAULT_LOCALE, LOCALES, type Locale } from '@heach/i18n';

/** Highest-quality supported language in Accept-Language, else Odia (I18N-01). */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  const preferences = (acceptLanguage ?? '').split(',').map((part) => {
    const [range = '', ...parameters] = part.trim().toLowerCase().split(';');
    const quality = parameters.map((parameter) => parameter.trim()).find((p) => p.startsWith('q='));
    const value = quality?.slice(2);
    let q = 1;
    if (value !== undefined)
      q = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(value) ? Number(value) : 0;
    return { code: range.split('-')[0], q };
  });
  preferences.sort((a, b) => b.q - a.q);
  for (const { code, q } of preferences) {
    const match = LOCALES.find((locale) => locale === code);
    if (q > 0 && match) return match;
  }
  return DEFAULT_LOCALE;
}
