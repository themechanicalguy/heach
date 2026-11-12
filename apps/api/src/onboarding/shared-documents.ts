import type { SharedDocument } from '../adapters/identity.port.js';
import type { ChecklistItem } from './checklists.js';

// The checklist items an issued document can stand for, in order of preference.
const ITEMS_FOR: Record<SharedDocument['type'], readonly string[]> = {
  degree_certificate: ['qualification_certificate'],
  registration_certificate: [
    'nursing_registration',
    'council_registration',
    'establishment_registration',
  ],
  pan_card: [],
  driving_licence: [],
};

/**
 * The checklist item a shared document fills (KY-02), or undefined when it is not kept: it is
 * not on this role's checklist (PR-02: nothing unused is stored), or it lacks the number or
 * expiry date the item needs.
 */
export function checklistItemFor(
  document: Pick<SharedDocument, 'type' | 'reference' | 'expiresOn'>,
  checklist: readonly ChecklistItem[],
): ChecklistItem | undefined {
  const entry = checklist.find((item) => ITEMS_FOR[document.type].includes(item.key));
  if (!entry) return undefined;
  if ((entry.reference && !document.reference) || (entry.expiry && !document.expiresOn)) {
    return undefined;
  }
  return entry;
}
