/** Roles a person may ask for at registration; the API checks the same list (decision L-2). */
export const CARE_CHOICES = ['patient', 'representative'] as const;
export const PROVIDER_CHOICES = [
  'doctor',
  'dentist',
  'dermatologist',
  'physiotherapist',
  'nurse',
  'attendant',
  'lab',
  'sample_collector',
] as const;
export type RoleChoice = (typeof CARE_CHOICES)[number] | (typeof PROVIDER_CHOICES)[number];

export const GENDERS = ['female', 'male', 'other', 'undisclosed'] as const;
export type Gender = (typeof GENDERS)[number];

export function isProviderChoice(role: string | null): boolean {
  return (PROVIDER_CHOICES as readonly string[]).includes(role ?? '');
}
