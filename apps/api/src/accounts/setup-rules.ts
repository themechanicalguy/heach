import {
  CARE_ROLES,
  type CareRole,
  type GrantedUserRole,
  NEW_ACCOUNT,
  type ProviderRole,
  type UserRole,
} from '../common/request-context.js';

/**
 * Roles a person may ask for at registration (decision L-2). Staff roles come only from an
 * organisation's invitation (owner decision O-1), never chosen here. Asking is not getting: the
 * server grants (L-3).
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
] as const satisfies readonly GrantedUserRole[];

/** Provider roles held only through an organisation's membership (O-1). */
export const STAFF_ROLES = ['clinic_front_desk', 'sample_collector'] as const;

export type RegistrableRole = (typeof SELF_REGISTRABLE_ROLES)[number];
export type StaffRole = (typeof STAFF_ROLES)[number];
/** The role setup will grant: one asked for, or one an accepted invitation carries. */
export type SetupRole = RegistrableRole | StaffRole;
export type Side = 'care' | 'provider';
// Names in Odia, Devanagari or Latin script (I18N-04); no digits or markup.
export const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;
export const GENDERS = ['female', 'male', 'other', 'undisclosed'] as const;
export type Gender = (typeof GENDERS)[number];

/** What setup has saved so far (decision L-5). */
export interface SetupDraft {
  role: SetupRole | null;
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

export function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
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
  const needsLanguages = sideOf(draft.role) === 'provider' && !isStaffRole(draft.role);
  if (needsLanguages && draft.languages.length === 0) missing.push('languages');
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
