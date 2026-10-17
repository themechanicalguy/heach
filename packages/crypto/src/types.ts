/** Each domain has its own keys, so one compromised key exposes one domain only (EN-06). */
export type DataDomain = 'health' | 'identity' | 'payments' | 'documents';

export const DATA_DOMAINS: readonly DataDomain[] = ['health', 'identity', 'payments', 'documents'];

/** What is stored in the database in place of a Restricted value. */
export interface EncryptedField {
  /** Base64 of IV, auth tag and ciphertext. */
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
