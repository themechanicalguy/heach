import type { BlindIndexer, FieldEncryptor } from '@heach/crypto';

/** Injection token for field-level encryption of Restricted data (EN-03 to EN-06). */
export const FIELD_ENCRYPTOR = Symbol('FIELD_ENCRYPTOR');

/** Injection token for blind indexes of searchable Restricted fields (EN-09). */
export const BLIND_INDEXER = Symbol('BLIND_INDEXER');

export type { BlindIndexer, FieldEncryptor };
