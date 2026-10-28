import {
  CARE_ROLES,
  type CareRole,
  type GrantedUserRole,
  NEW_ACCOUNT,
  type ProviderRole,
  type UserRole,
} from '../common/request-context.js';

/**
 * Roles a person may ask for at registration (decision L-2). Clinic front desk accounts are made
 * by a clinic (Step 7), never chosen here. Asking is not getting: the server grants (L-3).
 */
export const SELF_REGISTRABLE_ROLES = [
  'patient',
  'representative',
  'doctor',
  'dentist',
  'dermatologist',
  'physiotherapist',
  'nurse',
  'attendant',
  'lab',
  'sample_collector',
] as const satisfies readonly GrantedUserRole[];

export type RegistrableRole = (typeof SELF_REGISTRABLE_ROLES)[number];
export type Side = 'care' | 'provider';
export const GENDERS = ['female', 'male', 'other', 'undisclosed'] as const;
export type Gender = (typeof GENDERS)[number];

/** What setup has saved so far (decision L-5). */
export interface SetupDraft {
  role: RegistrableRole | null;
  fullName: string | null;
  gender: Gender | null;
  languages: readonly string[];
  organisationName: string | null;
  adultDeclared: boolean;
}

export type SetupStep = 'role' | 'details' | 'consent';
export type MissingField = 'role' | 'fullName' | 'gender' | 'adult' | 'languages' | 'organisation';

export function isRegistrableRole(value: string): value is RegistrableRole {
  return (SELF_REGISTRABLE_ROLES as readonly string[]).includes(value);
}

export function sideOf(role: GrantedUserRole): Side {
  return (CARE_ROLES as readonly string[]).includes(role) ? 'care' : 'provider';
}

/** Basic details each role needs before setup can finish. */
export function missingFields(draft: SetupDraft): MissingField[] {
  const missing: MissingField[] = [];
  if (!draft.role) return ['role'];
  if (!draft.fullName) missing.push('fullName');
  if (!draft.gender) missing.push('gender');
  if (!draft.adultDeclared) missing.push('adult');
  if (sideOf(draft.role) === 'provider' && draft.languages.length === 0) missing.push('languages');
  if (draft.role === 'lab' && !draft.organisationName) missing.push('organisation');
  return missing;
}

/** Where a returning user resumes setup. */
export function nextSetupStep(draft: SetupDraft): SetupStep {
  const missing = missingFields(draft);
  if (missing.includes('role')) return 'role';
  return missing.length > 0 ? 'details' : 'consent';
}

/**
 * The role a sign-in starts in: the one used last if it is still granted, else the care role,
 * else the provider role; `new_account` while setup has granted nothing.
 */
export function initialRole(
  granted: readonly { role: GrantedUserRole; side: Side }[],
  lastActive: string | null,
): UserRole {
  const last = granted.find((grant) => grant.role === lastActive);
  if (last) return last.role;
  const care = granted.find((grant) => grant.side === 'care');
  return (care ?? granted[0])?.role ?? NEW_ACCOUNT;
}

/** The provider side's first status: an application is a draft until submitted (PO-04). */
export const NEW_PROVIDER_STATUS = 'draft';

export type { CareRole, ProviderRole };
