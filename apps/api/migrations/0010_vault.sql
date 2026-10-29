-- Up Migration
-- The e-medical record vault (Step 8, J9): records and the history profile for the account and
-- each linked patient (MV-01 to MV-05), filed automatically from visits and labs (MV-02), shared
-- per booking (MV-07, MV-08) or by an expiring link with a code (MV-09), with an access history
-- (MV-10). All content is Restricted and encrypted (MV-11); only metadata stays in clear.

INSERT INTO app.setting (key, value) VALUES ('vault_quota_mb', 200);

CREATE TABLE app.vault_record (
  id uuid PRIMARY KEY,
  owner_account_id uuid NOT NULL REFERENCES app.account (id) ON DELETE CASCADE,
  linked_patient_id uuid REFERENCES app.linked_patient (id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('patient', 'visit', 'lab', 'provider')),
  record_type text NOT NULL CHECK (record_type IN (
    'prescription', 'lab_report', 'scan', 'discharge_summary', 'vaccination', 'visit_note', 'other'
  )),
  record_date date NOT NULL,
  -- Title, facility, tags and notes, encrypted together in the health domain.
  details app.encrypted_field NOT NULL,
  object_id uuid REFERENCES app.stored_object (id),
  booking_id uuid REFERENCES app.booking (id) ON DELETE SET NULL,
  issued_by_account_id uuid REFERENCES app.account (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((source = 'patient') = (issued_by_account_id IS NULL))
);
CREATE INDEX vault_record_by_owner ON app.vault_record (owner_account_id, record_date DESC);
CREATE UNIQUE INDEX vault_record_one_filing ON app.vault_record (booking_id, source) WHERE source IN ('visit', 'lab');
COMMENT ON COLUMN app.vault_record.id IS 'class=Internal';
COMMENT ON COLUMN app.vault_record.owner_account_id IS 'class=Internal';
COMMENT ON COLUMN app.vault_record.linked_patient_id IS 'class=Internal';
COMMENT ON COLUMN app.vault_record.source IS 'class=Internal';
COMMENT ON COLUMN app.vault_record.record_type IS 'class=Confidential';
COMMENT ON COLUMN app.vault_record.record_date IS 'class=Confidential';
COMMENT ON COLUMN app.vault_record.details IS 'class=Restricted';
COMMENT ON COLUMN app.vault_record.object_id IS 'class=Internal';
COMMENT ON COLUMN app.vault_record.booking_id IS 'class=Internal';
COMMENT ON COLUMN app.vault_record.issued_by_account_id IS 'class=Internal';
COMMENT ON COLUMN app.vault_record.created_at IS 'class=Internal';

-- The medical history profile (MV-05): structured entries, each attributed.
CREATE TABLE app.history_entry (
  id uuid PRIMARY KEY,
  owner_account_id uuid NOT NULL REFERENCES app.account (id) ON DELETE CASCADE,
  linked_patient_id uuid REFERENCES app.linked_patient (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'allergy', 'condition', 'medicine', 'surgery', 'blood_group', 'vaccination', 'family_history'
  )),
  content app.encrypted_field NOT NULL,
  added_by_account_id uuid REFERENCES app.account (id) ON DELETE SET NULL,
  added_by_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX history_entry_by_owner ON app.history_entry (owner_account_id, linked_patient_id);
COMMENT ON COLUMN app.history_entry.id IS 'class=Internal';
COMMENT ON COLUMN app.history_entry.owner_account_id IS 'class=Internal';
COMMENT ON COLUMN app.history_entry.linked_patient_id IS 'class=Internal';
COMMENT ON COLUMN app.history_entry.kind IS 'class=Confidential';
COMMENT ON COLUMN app.history_entry.content IS 'class=Restricted';
COMMENT ON COLUMN app.history_entry.added_by_account_id IS 'class=Internal';
COMMENT ON COLUMN app.history_entry.added_by_role IS 'class=Internal';
COMMENT ON COLUMN app.history_entry.created_at IS 'class=Internal';

-- A share with one provider for one booking (MV-07): view only, until it expires or is revoked.
CREATE TABLE app.record_share (
  id uuid PRIMARY KEY,
  owner_account_id uuid NOT NULL REFERENCES app.account (id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES app.booking (id) ON DELETE CASCADE,
  provider_account_id uuid NOT NULL REFERENCES app.account (id),
  record_ids uuid[] NOT NULL,
  include_history boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX record_share_by_booking ON app.record_share (booking_id, provider_account_id);
COMMENT ON COLUMN app.record_share.id IS 'class=Internal';
COMMENT ON COLUMN app.record_share.owner_account_id IS 'class=Internal';
COMMENT ON COLUMN app.record_share.booking_id IS 'class=Internal';
COMMENT ON COLUMN app.record_share.provider_account_id IS 'class=Internal';
COMMENT ON COLUMN app.record_share.record_ids IS 'class=Internal';
COMMENT ON COLUMN app.record_share.include_history IS 'class=Internal';
COMMENT ON COLUMN app.record_share.expires_at IS 'class=Internal';
COMMENT ON COLUMN app.record_share.revoked_at IS 'class=Internal';
COMMENT ON COLUMN app.record_share.created_at IS 'class=Internal';

-- A link for a doctor outside the application (MV-09): token and code kept as keyed hashes only.
CREATE TABLE app.external_share (
  id uuid PRIMARY KEY,
  owner_account_id uuid NOT NULL REFERENCES app.account (id) ON DELETE CASCADE,
  record_ids uuid[] NOT NULL,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  code_hash text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  attempts smallint NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN app.external_share.id IS 'class=Internal';
COMMENT ON COLUMN app.external_share.owner_account_id IS 'class=Internal';
COMMENT ON COLUMN app.external_share.record_ids IS 'class=Internal';
COMMENT ON COLUMN app.external_share.token_hash IS 'class=Confidential';
COMMENT ON COLUMN app.external_share.code_hash IS 'class=Confidential';
COMMENT ON COLUMN app.external_share.attempts IS 'class=Internal';
COMMENT ON COLUMN app.external_share.expires_at IS 'class=Internal';
COMMENT ON COLUMN app.external_share.revoked_at IS 'class=Internal';
COMMENT ON COLUMN app.external_share.created_at IS 'class=Internal';

-- Every read of a record by someone other than its owner (MV-10).
CREATE TABLE app.record_access (
  id uuid PRIMARY KEY,
  record_id uuid NOT NULL REFERENCES app.vault_record (id) ON DELETE CASCADE,
  accessor_account_id uuid REFERENCES app.account (id) ON DELETE SET NULL,
  accessor_role text NOT NULL,
  share_id uuid REFERENCES app.record_share (id) ON DELETE SET NULL,
  external_share_id uuid REFERENCES app.external_share (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX record_access_by_record ON app.record_access (record_id, created_at DESC);
COMMENT ON COLUMN app.record_access.id IS 'class=Internal';
COMMENT ON COLUMN app.record_access.record_id IS 'class=Internal';
COMMENT ON COLUMN app.record_access.accessor_account_id IS 'class=Internal';
COMMENT ON COLUMN app.record_access.accessor_role IS 'class=Internal';
COMMENT ON COLUMN app.record_access.share_id IS 'class=Internal';
COMMENT ON COLUMN app.record_access.external_share_id IS 'class=Internal';
COMMENT ON COLUMN app.record_access.created_at IS 'class=Internal';
