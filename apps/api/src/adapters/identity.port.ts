/** The person's details as the partner verified them (KY-03). */
export interface VerifiedAttributes {
  fullName: string;
  gender: 'female' | 'male' | 'other';
  /** YYYY-MM-DD. */
  dateOfBirth: string;
  address: string;
  /** The photo on the identity document, when the partner shares it. */
  photo?: { contentType: string; contentBase64: string };
}

/** A document the person chose to share from DigiLocker, as its issuer published it (KY-02). */
export interface SharedDocument {
  type: 'degree_certificate' | 'registration_certificate' | 'pan_card' | 'driving_licence';
  /** The body that issued it, for example a university or a council. */
  issuer: string;
  /** The registration or certificate number, when the document has one. */
  reference?: string;
  /** YYYY-MM-DD, when the document expires. */
  expiresOn?: string;
  contentType: string;
  contentBase64: string;
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
  /** Issued documents shared along with a verified DigiLocker result. */
  documents?: SharedDocument[];
}

/** Aadhaar and DigiLocker identity proof (KY, Step 3): consent redirect, then the verified result. */
export interface IdentityVerifier {
  /** The partner's consent page; it sends the person back to `returnUrl` with a one-time code. */
  startConsent(reference: string, returnUrl: string): Promise<{ redirectUrl: string }>;
  completeConsent(code: string): Promise<IdentityResult>;
}
export const IDENTITY_VERIFIER = Symbol('IDENTITY_VERIFIER');
