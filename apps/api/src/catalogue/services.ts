import type { OnboardingRole } from '../onboarding/checklists.js';

/** The four MVP services (ADR 0015) and the provider type that offers each. */
export const SERVICES = ['physiotherapy', 'nursing', 'attendant', 'lab'] as const;
export type Service = (typeof SERVICES)[number];

export const SERVICE_ROLE: Record<Service, OnboardingRole> = {
  physiotherapy: 'physiotherapist',
  nursing: 'nurse',
  attendant: 'attendant',
  lab: 'lab',
};

export function serviceOf(role: OnboardingRole): Service | undefined {
  return SERVICES.find((service) => SERVICE_ROLE[service] === role);
}

/** Attendant shifts start at a fixed time of day, in minutes after midnight IST (SL-04). */
export const SHIFT_START_MINUTE: Readonly<Record<string, number>> = {
  attendant_day_12h: 8 * 60,
  attendant_night_12h: 20 * 60,
  attendant_24h: 8 * 60,
};
