import type { MessageKey, Messages } from '@heach/i18n';

type Key = MessageKey<Messages>;

// The catalogue of the page's locale, registered by I18nProvider; no catalogue is imported here,
// so this module adds no language data to the bundle.
let active: Messages | undefined;

export function registerMessages(messages: Messages): void {
  active = messages;
}

/** Whether the active catalogue has text for this dotted key. */
export function hasMessage(path: string): boolean {
  let node: unknown = active;
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
  return hasMessage(path) ? (path as Key) : fallback;
}
