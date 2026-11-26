-- Up Migration
-- Identity check, second part (KY-01, KY-05, KY-07): consent before the check, the partner's
-- last four digits and transaction reference kept encrypted, and a manual fallback where the
-- provider uploads another identity document that a verifier reviews.

-- The partner's detail as one encrypted JSON document: last four digits and transaction reference.
ALTER TABLE app.identity_check ADD COLUMN detail app.encrypted_field;
COMMENT ON COLUMN app.identity_check.detail IS 'class=Restricted';

-- The manual fallback's document. An Aadhaar card is never accepted here: its copy would carry
-- the full number (PR-03).
ALTER TABLE app.identity_check
  ADD COLUMN document_object_id uuid REFERENCES app.stored_object (id),
  ADD COLUMN document_kind text CHECK (document_kind IN (
    'voter_id', 'passport', 'driving_licence', 'pan_card'
  )),
  ADD CONSTRAINT identity_check_manual_document CHECK (
    (method IS NOT DISTINCT FROM 'manual') = (document_object_id IS NOT NULL)
    AND (document_object_id IS NULL) = (document_kind IS NULL)
  );
COMMENT ON COLUMN app.identity_check.document_object_id IS 'class=Internal';
COMMENT ON COLUMN app.identity_check.document_kind IS 'class=Confidential';

-- Consent to the identity check is its own purpose, asked just before the check (PR-01).
ALTER TABLE app.consent_record DROP CONSTRAINT consent_record_purpose_check;
ALTER TABLE app.consent_record ADD CONSTRAINT consent_record_purpose_check
  CHECK (purpose IN ('terms', 'privacy', 'identity_verification'));
