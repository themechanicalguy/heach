import type { ProviderRole } from '../common/request-context.js';

/** A document on a provider type's checklist (PO-01). Configuration, so items change without code. */
export interface ChecklistItem {
  key: string;
  required: boolean;
  /** The registration or certificate number must be typed in. */
  reference: boolean;
  /** The document expires; an expired one pauses listings (Q-POLICE, A7). */
  expiry: boolean;
}

/** Provider types onboarded in the MVP (ADR 0015 defers the rest). */
export const ONBOARDING_ROLES = [
  'physiotherapist',
  'nurse',
  'attendant',
  'lab',
  'sample_collector',
] as const satisfies readonly ProviderRole[];
export type OnboardingRole = (typeof ONBOARDING_ROLES)[number];

const item = (
  key: string,
  required: boolean,
  reference = false,
  expiry = false,
): ChecklistItem => ({
  key,
  required,
  reference,
  expiry,
});

// Police verification is required for everyone who visits a home (owner decision Q-POLICE).
const POLICE = item('police_verification', true, true, true);

export const CHECKLISTS: Record<OnboardingRole, readonly ChecklistItem[]> = {
  nurse: [
    item('nursing_registration', true, true, true),
    item('qualification_certificate', true),
    POLICE,
  ],
  physiotherapist: [
    item('qualification_certificate', true),
    item('council_registration', false, true, true),
    POLICE,
  ],
  attendant: [
    item('address_proof', true),
    item('reference_letter', true),
    item('training_certificate', false),
    POLICE,
  ],
  lab: [
    item('establishment_registration', true, true, true),
    item('nabl_certificate', false, true, true),
  ],
  sample_collector: [item('qualification_certificate', true), POLICE],
};

export function isOnboardingRole(role: string): role is OnboardingRole {
  return (ONBOARDING_ROLES as readonly string[]).includes(role);
}

/** Payouts go to the provider who is paid; a lab's collectors are paid by the lab. */
export function needsPayout(role: OnboardingRole): boolean {
  return role !== 'sample_collector';
}

export function checklistItem(role: OnboardingRole, key: string): ChecklistItem | undefined {
  return CHECKLISTS[role].find((entry) => entry.key === key);
}
