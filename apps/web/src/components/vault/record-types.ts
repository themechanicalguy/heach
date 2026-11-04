import type { IconName } from '@heach/ui';
import type { VaultRecord } from '@heach/types';

export const RECORD_TYPES = [
  'prescription',
  'lab_report',
  'scan',
  'discharge_summary',
  'vaccination',
  'visit_note',
  'other',
] as const satisfies readonly VaultRecord['recordType'][];

export const HISTORY_KINDS = [
  'allergy',
  'condition',
  'medicine',
  'surgery',
  'blood_group',
  'vaccination',
  'family_history',
] as const;

/** Each record type's icon well (design reference, Records A): lab results take the peach well. */
export const TYPE_ICON: Record<VaultRecord['recordType'], { icon: IconName; tone: string }> = {
  prescription: { icon: 'note', tone: 'lavender' },
  lab_report: { icon: 'lab', tone: 'peach' },
  scan: { icon: 'image', tone: 'neutral' },
  discharge_summary: { icon: 'file', tone: 'lavender' },
  vaccination: { icon: 'shield', tone: 'lavender' },
  visit_note: { icon: 'nurse', tone: 'lavender' },
  other: { icon: 'file', tone: 'neutral' },
};
