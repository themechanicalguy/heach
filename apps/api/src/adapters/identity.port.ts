/** The person's details as the partner verified them (KY-03). */
export interface VerifiedAttributes {
  fullName: string;
  gender: 'female' | 'male' | 'other';
  /** YYYY-MM-DD. */
  dateOfBirth: string;
  address: string;
}

/** What the partner tells us; it never sends the Aadhaar number itself (KY-05, PR-03). */
export interface IdentityResult {
  verified: boolean;
  documentType: 'aadhaar' | 'digilocker';
  /** Last four digits of the Aadhaar number, when the partner shares them. */
  lastFour?: string;
  /** The partner's own reference for this check, kept as evidence. */
  transactionId: string;
  /** Present only when verified and the person agreed to share them. */
  attributes?: VerifiedAttributes;
}

/** Aadhaar and DigiLocker identity proof (KY, Step 3): consent redirect, then the verified result. */
export interface IdentityVerifier {
  /** The partner's consent page; it sends the person back to `returnUrl` with a one-time code. */
  startConsent(reference: string, returnUrl: string): Promise<{ redirectUrl: string }>;
  completeConsent(code: string): Promise<IdentityResult>;
}
export const IDENTITY_VERIFIER = Symbol('IDENTITY_VERIFIER');
