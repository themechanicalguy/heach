export const BODY_AREAS = [
  'back',
  'neck',
  'shoulder',
  'knee',
  'hip',
  'ankle_foot',
  'other',
] as const;

/** What a provider needs to know before a home visit; stored encrypted as JSON (Restricted). */
export interface Intake {
  reason?: string;
  area?: (typeof BODY_AREAS)[number];
  ageYears?: number;
  contactName?: string;
  contactPhone?: string;
}

export function isEmptyIntake(intake: Intake | undefined): boolean {
  return !intake || Object.values(intake).every((value) => value === undefined || value === '');
}

/** Tolerates rows written before a field existed; anything unreadable is treated as absent. */
export function parseIntake(json: string | null): Intake | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as Intake;
  } catch {
    return null;
  }
}
