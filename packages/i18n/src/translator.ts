import { formatIcu, type MessageValues } from './icu.js';
import type { Locale } from './locales.js';

export interface MessageTree {
  readonly [key: string]: string | MessageTree;
}

/** Dot-separated paths to every string leaf of a messages object, e.g. `home.title`. */
export type MessageKey<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : MessageKey<T[K], `${P}${K}.`>;
}[keyof T & string];

export type Translator<T> = (key: MessageKey<T> & string, values?: MessageValues) => string;

/** Looks up a key and formats it as ICU for the locale. Throws on a missing key. */
export function createTranslator<T extends MessageTree>(
  messages: T,
  locale: Locale = 'en',
): Translator<T> {
  return (key, values = {}) => {
    const value = key
      .split('.')
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        messages,
      );
    if (typeof value !== 'string') {
      throw new Error(`Missing message: ${key}`);
    }
    return formatIcu(value, values, locale);
  };
}
