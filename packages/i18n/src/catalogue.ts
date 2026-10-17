import en from './messages/en.json' with { type: 'json' };
import hi from './messages/hi.json' with { type: 'json' };
import or from './messages/or.json' with { type: 'json' };
import type { Locale } from './locales.js';

/** The ICU catalogues (I18N-01). English is the reference shape for keys and types. */
export type Messages = typeof en;

export const CATALOGUES: Readonly<Record<Locale, Messages>> = { or, en, hi };

/** Adding a locale = a catalogue file, an entry here and one in LOCALES (I18N-01.1). */
export function messagesFor(locale: Locale): Messages {
  return CATALOGUES[locale];
}
