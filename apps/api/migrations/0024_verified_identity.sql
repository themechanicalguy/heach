-- Up Migration
-- KY-03, KY-04: what the identity partner verified. Name and gender are copied to the profile
-- and locked there; date of birth and address are kept as one encrypted JSON document. The
-- name-match flag tells the verifier that the name typed at sign-up differed from the verified one.
ALTER TABLE app.identity_check
  ADD COLUMN verified_details app.encrypted_field,
  ADD COLUMN name_match text CHECK (name_match IN ('match', 'mismatch'));
COMMENT ON COLUMN app.identity_check.verified_details IS 'class=Restricted';
COMMENT ON COLUMN app.identity_check.name_match IS 'class=Confidential';
