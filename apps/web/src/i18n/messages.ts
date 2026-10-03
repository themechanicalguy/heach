import en from '../../messages/en.json';

/**
 * Temporary message lookup so no user-facing string is hard-coded.
 * Step 2 replaces this with ICU catalogues for or, en and hi; callers keep using `t(key)`.
 */
type Messages = typeof en;
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;

export function t(key: MessageKey): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en);
  if (typeof value !== 'string') {
    throw new Error(`Missing message: ${key}`);
  }
  return value;
}
