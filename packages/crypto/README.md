# @heach/crypto

Field-level envelope encryption of Restricted data (EN-03 to EN-06) and blind indexes (EN-09).

> **Do not implement cryptography in this package or anywhere else ad hoc.**
> No home-made ciphers, no hard-coded or locally generated keys, no "temporary" encryption,
> no base64 or hashing passed off as encryption. A wrong implementation looks like it works
> and silently exposes patient data.

| File                    | What it does                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `types.ts`              | `DataDomain` (health, identity, payments, documents, each with its own key, EN-06) and `EncryptedField`, stored in place of a Restricted value with its key version (EN-05)                                        |
| `key-provider.ts`       | `KeyProvider`, the port to a managed KMS in India that generates and unwraps data keys (EN-04), and `LocalKeyProvider` for local use and tests; the API's KMS adapter is `apps/api/src/crypto/kms-key-provider.ts` |
| `data-key-store.ts`     | `DataKeyStore`, wrapped data keys per domain and version, with an in-memory store for tests                                                                                                                        |
| `envelope.ts`           | `EnvelopeEncryptor`: AES-256-GCM with a fixed tag length and versioned data keys (EN-03, EN-05)                                                                                                                    |
| `blind-index.ts`        | `BlindIndexer`: HMAC-SHA-256 blind indexes with a key derived per domain, for searchable fields (EN-09)                                                                                                            |
| `is-encrypted-field.ts` | `isEncryptedField(value)`: a shape check only                                                                                                                                                                      |

Changes here are security-reviewed before merge. Tests that Restricted fields are ciphertext in
the database and absent from logs live in the API (EN-13).
