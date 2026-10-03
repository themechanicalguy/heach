/** Supported locales. The i18n package takes ownership of this in Step 2. */
export const LOCALES = ['or', 'en', 'hi'] as const;

export type Locale = (typeof LOCALES)[number];
