/** Aadhaar and DigiLocker identity proof (KY, Step 3): consent redirect, then the verified result. */
export interface IdentityVerifier {
  /** The partner's consent page; it sends the person back to `returnUrl` with a one-time code. */
  startConsent(reference: string, returnUrl: string): Promise<{ redirectUrl: string }>;
  completeConsent(
    code: string,
  ): Promise<{ verified: boolean; documentType: 'aadhaar' | 'digilocker' }>;
}
export const IDENTITY_VERIFIER = Symbol('IDENTITY_VERIFIER');
