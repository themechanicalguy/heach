import { AsyncLocalStorage } from 'node:async_hooks';

/** Care side of an account (AC-04): a representative also books for themself (decision L-2). */
export const CARE_ROLES = ['patient', 'representative'] as const;
/** Provider side of an account: at most one provider type per account. */
export const PROVIDER_ROLES = [
  'doctor',
  'dentist',
  'dermatologist',
  'physiotherapist',
  'nurse',
  'attendant',
  'lab',
  'sample_collector',
  'clinic_front_desk',
] as const;
/** Admin sub-roles (AD-01); admins are a separate realm with their own sign-in. */
export const ADMIN_ROLES = ['super_admin', 'verifier', 'support', 'finance'] as const;

/**
 * A signed-in account whose setup has not granted a role yet: it may only finish setup, read its
 * own account and sign out.
 */
export const NEW_ACCOUNT = 'new_account';

export type CareRole = (typeof CARE_ROLES)[number];
export type ProviderRole = (typeof PROVIDER_ROLES)[number];
export type AdminRole = (typeof ADMIN_ROLES)[number];
export type GrantedUserRole = CareRole | ProviderRole;
export type UserRole = GrantedUserRole | typeof NEW_ACCOUNT;
export type Role = UserRole | AdminRole;

/** Roles an account can be granted (care and provider sides). */
export const GRANTED_USER_ROLES: readonly GrantedUserRole[] = [...CARE_ROLES, ...PROVIDER_ROLES];
/** Every role of patients and providers, who sign in by OTP. */
export const USER_ROLES: readonly UserRole[] = [...GRANTED_USER_ROLES, NEW_ACCOUNT];
export const ROLES: readonly Role[] = [...USER_ROLES, ...ADMIN_ROLES];

/** Which sign-in a session came from; role names never overlap between realms. */
export type Realm = 'user' | 'admin';

export interface Principal {
  userId: string;
  /** The active role, granted and checked by the server; never taken from the browser. */
  role: Role;
  sessionId: string;
  realm: Realm;
}

/** Per-request values that logs, audit entries and queries pick up (LM-01, SE-05). */
export interface RequestContext {
  correlationId: string;
  principal?: Principal;
  /** A system job acting with no user, for example `job:reencrypt`; set only by the job itself. */
  system?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function currentContext(): RequestContext | undefined {
  return storage.getStore();
}
