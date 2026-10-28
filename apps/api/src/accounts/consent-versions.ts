/** Purposes asked at sign-up (PR-01): terms of use and the privacy notice, each its own choice. */
export const CONSENT_PURPOSES = ['terms', 'privacy'] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

/**
 * The text version in force per purpose (decision L-12). Raising one makes it due again for
 * everyone, and routing asks for it at the next visit. `draft` texts await the lawyer (FU-06).
 */
export const CURRENT_CONSENT_VERSIONS: Readonly<Record<ConsentPurpose, string>> = {
  terms: '2026-10-draft.1',
  privacy: '2026-10-draft.1',
};

export interface ConsentGiven {
  purpose: ConsentPurpose;
  version: string;
}

/** Current consents the account has not given (or has withdrawn). */
export function consentsDue(given: readonly ConsentGiven[]): ConsentGiven[] {
  return CONSENT_PURPOSES.filter(
    (purpose) =>
      !given.some((g) => g.purpose === purpose && g.version === CURRENT_CONSENT_VERSIONS[purpose]),
  ).map((purpose) => ({ purpose, version: CURRENT_CONSENT_VERSIONS[purpose] }));
}

/** True when the submitted consents are exactly the current version of every purpose. */
export function coversCurrentVersions(submitted: readonly ConsentGiven[]): boolean {
  return consentsDue(submitted).length === 0;
}
