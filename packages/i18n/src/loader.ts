import type { Locale } from './locales.js';

/**
 * Stub for Step 2. The real loader returns the ICU catalogue for a locale from the shared
 * translation files; until then each app passes its own messages to `createTranslator`.
 */
export type MessageLoader<T> = (locale: Locale) => Promise<T>;

export function loadMessages<T>(locale: Locale): Promise<T> {
  return Promise.reject(new Error(`loadMessages(${locale}) arrives in Step 2 (ICU catalogues)`));
}
