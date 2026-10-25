# @heach/crypto

The contract for field-level encryption of Restricted data. **Interface only.**

> **Do not implement cryptography in this package or anywhere else ad hoc.**
> No home-made ciphers, no hard-coded or locally generated keys, no "temporary" encryption,
> no base64 or hashing passed off as encryption. A wrong implementation looks like it works
> and silently exposes patient data.

What exists now:

- `DataDomain`: health, identity, payments, documents, each with separate keys (EN-06).
- `EncryptedField`: what is stored in place of a Restricted value, with its key version (EN-05).
- `FieldEncryptor`: `encrypt`, `decrypt`, `currentKeyVersion`.
- `isEncryptedField(value)`: a shape check only.

What arrives in Step 2 (guideline Step 2, item 1), reviewed before merge:

- Envelope encryption with data keys protected by a managed KMS in an India region (EN-04).
- Authenticated encryption from a vetted library, key versioning and rotation (EN-03, EN-05).
- Blind indexes for searchable fields (EN-09).
- Tests that Restricted fields are ciphertext in the database and absent from logs (EN-13).
