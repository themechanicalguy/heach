import { type MessageKey, type Messages, messagesFor } from '@heach/i18n';

type Key = MessageKey<Messages>;

function exists(path: string): boolean {
  let node: unknown = messagesFor('en');
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string';
}

/**
 * The catalogue key for a value the API sends (a checklist item, a reason, a role), or the
 * fallback when the catalogue has no text for it, so an unknown value never shows a raw key.
 */
export function keyFor(prefix: string, value: string, fallback: Key, suffix = ''): Key {
  const path = `${prefix}.${value}${suffix}`;
  return exists(path) ? (path as Key) : fallback;
}
