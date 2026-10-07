import type { FieldEncryptor } from '@heach/crypto';

/**
 * Injection token for field-level encryption of Restricted data. No provider is registered
 * until Step 2 brings the real implementation; injecting it before then fails at startup.
 */
export const FIELD_ENCRYPTOR = Symbol('FIELD_ENCRYPTOR');

export type { FieldEncryptor };
