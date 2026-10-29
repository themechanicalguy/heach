import { t } from '../i18n';
import en from '../../messages/en.json';

type Groups = Record<string, unknown>;

/**
 * The label for a value the API sends (a status, a reason) from a group of the catalogue, such
 * as `verification.statuses`; the raw value only when the catalogue has none.
 */
export function label(group: string, value: string): string {
  let node: unknown = en;
  for (const part of group.split('.')) node = (node as Groups | undefined)?.[part];
  const known = typeof node === 'object' && node !== null && value in node;
  return known ? t(`${group}.${value}` as Parameters<typeof t>[0]) : value;
}
