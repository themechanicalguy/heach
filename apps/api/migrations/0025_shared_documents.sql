-- Up Migration
-- KY-02: a document the provider shared from DigiLocker is an issued copy, not an upload. The
-- row says so and names the issuer, so the verifier knows it needs no authenticity check.
ALTER TABLE app.provider_document
  ADD COLUMN source text NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'digilocker')),
  ADD COLUMN issuer text CHECK (char_length(issuer) BETWEEN 1 AND 120),
  ADD CONSTRAINT provider_document_issued CHECK ((source = 'digilocker') = (issuer IS NOT NULL));
COMMENT ON COLUMN app.provider_document.source IS 'class=Internal';
COMMENT ON COLUMN app.provider_document.issuer IS 'class=Confidential';
