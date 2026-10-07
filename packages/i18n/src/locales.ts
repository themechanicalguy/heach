/** Launch locales (I18N-01). Odia is the default for patients and providers. */
export const LOCALES = ['or', 'en', 'hi'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'or';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
