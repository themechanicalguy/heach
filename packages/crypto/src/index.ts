/**
 * Contract for field-level encryption of Restricted data (EN-03 to EN-06).
 * Interface only: the implementation arrives in Step 2. Do not implement cryptography here.
 */

/** Each domain has its own keys, so one compromised key exposes one domain only (EN-06). */
export type DataDomain = 'health' | 'identity' | 'payments' | 'documents';

/** What is stored in the database in place of a Restricted value. */
export interface EncryptedField {
  /** Base64 ciphertext including whatever the algorithm needs (nonce, auth tag). */
  readonly ciphertext: string;
  /** Version of the data key used, so rotated keys still decrypt old data (EN-05). */
  readonly keyVersion: string;
  readonly algorithm: string;
  readonly domain: DataDomain;
}

export interface FieldEncryptor {
  encrypt(plaintext: string, domain: DataDomain): Promise<EncryptedField>;
  decrypt(field: EncryptedField): Promise<string>;
  currentKeyVersion(domain: DataDomain): Promise<string>;
}

const DOMAINS: readonly string[] = ['health', 'identity', 'payments', 'documents'];

/** Shape check for values read back from storage. Says nothing about whether decryption works. */
export function isEncryptedField(value: unknown): value is EncryptedField {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const field = value as Record<string, unknown>;
  return (
    typeof field.ciphertext === 'string' &&
    typeof field.keyVersion === 'string' &&
    typeof field.algorithm === 'string' &&
    typeof field.domain === 'string' &&
    DOMAINS.includes(field.domain)
  );
}
