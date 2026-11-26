-- Up Migration
-- PO-05: what a provider's public profile shows beyond the account details: qualifications,
-- years of experience and a photo. The photo is a stored object; one that came from the identity
-- check is marked verified and cannot be replaced without a new check (KY-03).
CREATE TABLE app.provider_profile (
  account_id uuid PRIMARY KEY REFERENCES app.account (id) ON DELETE CASCADE,
  qualifications text CHECK (char_length(qualifications) BETWEEN 1 AND 300),
  experience_years smallint CHECK (experience_years BETWEEN 0 AND 60),
  photo_object_id uuid REFERENCES app.stored_object (id),
  photo_verified boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (photo_object_id IS NOT NULL OR NOT photo_verified)
);
COMMENT ON COLUMN app.provider_profile.account_id IS 'class=Internal';
COMMENT ON COLUMN app.provider_profile.qualifications IS 'class=Public';
COMMENT ON COLUMN app.provider_profile.experience_years IS 'class=Public';
COMMENT ON COLUMN app.provider_profile.photo_object_id IS 'class=Internal';
COMMENT ON COLUMN app.provider_profile.photo_verified IS 'class=Internal';
COMMENT ON COLUMN app.provider_profile.updated_at IS 'class=Internal';

ALTER TABLE app.stored_object DROP CONSTRAINT stored_object_purpose_check;
ALTER TABLE app.stored_object ADD CONSTRAINT stored_object_purpose_check CHECK (purpose IN (
  'provider_document', 'booking_attachment', 'visit_record', 'lab_report', 'vault_upload',
  'profile_photo'
));
