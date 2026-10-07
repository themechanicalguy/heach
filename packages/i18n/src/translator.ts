/**
 * Temporary message lookup so no user-facing string is hard-coded.
 * Step 2 replaces the internals with ICU catalogues for or, en and hi; callers keep using `t(key)`.
 */
interface MessageTree {
  readonly [key: string]: string | MessageTree;
}

/** Dot-separated paths to every string leaf of a messages object, e.g. `home.title`. */
export type MessageKey<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : MessageKey<T[K], `${P}${K}.`>;
}[keyof T & string];

export type Translator<T> = (key: MessageKey<T> & string) => string;

export function createTranslator<T extends MessageTree>(messages: T): Translator<T> {
  return (key) => {
    const value = key
      .split('.')
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        messages,
      );
    if (typeof value !== 'string') {
      throw new Error(`Missing message: ${key}`);
    }
    return value;
  };
}
