import type { VaultRecord } from '@heach/types';

/** Synthetic Storybook record; no real person or health information. */
export const SYNTHETIC_RECORD: VaultRecord = {
  id: '00000000-0000-4000-8000-000000000041',
  personId: null,
  source: 'patient',
  recordType: 'lab_report',
  recordDate: '2026-10-22',
  title: 'Synthetic report',
  facility: 'Synthetic laboratory',
  tags: [],
  notes: null,
  visitNotes: null,
  issuedBy: null,
  hasFile: false,
  createdAt: '2026-10-22T00:00:00Z',
};
