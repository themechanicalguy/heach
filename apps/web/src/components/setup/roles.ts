/**
 * Roles a person may ask for at registration; the API checks the same list (decision L-2). Staff
 * roles (sample collector, front desk) come only from an organisation's invitation (O-1).
 */
export const CARE_CHOICES = ['patient', 'representative'] as const;
export const PROVIDER_CHOICES = [
  'doctor',
  'dentist',
  'dermatologist',
  'physiotherapist',
  'nurse',
  'attendant',
  'lab',
] as const;
export const STAFF_ROLES = ['sample_collector', 'clinic_front_desk'] as const;
export type RoleChoice =
  (typeof CARE_CHOICES)[number] | (typeof PROVIDER_CHOICES)[number] | (typeof STAFF_ROLES)[number];

export const GENDERS = ['female', 'male', 'other', 'undisclosed'] as const;
export type Gender = (typeof GENDERS)[number];

export function isStaffRole(role: string | null): boolean {
  return (STAFF_ROLES as readonly string[]).includes(role ?? '');
}

export function isProviderChoice(role: string | null): boolean {
  return (PROVIDER_CHOICES as readonly string[]).includes(role ?? '');
}
