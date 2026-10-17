import { DATA_DOMAINS, type EncryptedField } from './types.js';

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
    (DATA_DOMAINS as readonly string[]).includes(field.domain)
  );
}
