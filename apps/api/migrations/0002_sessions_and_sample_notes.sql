-- Up Migration
-- Step 2 only: test identities, sessions and the sample note that proves the exit criteria.
-- user_test and patient_note are removed in Step 3.

CREATE TABLE app.user_test (
  id uuid PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('patient', 'provider', 'admin'))
);
COMMENT ON COLUMN app.user_test.id IS 'class=Internal';
COMMENT ON COLUMN app.user_test.role IS 'class=Internal';

-- Synthetic identities for the test identity adapter (SE-07.4); no real people.
INSERT INTO app.user_test (id, role) VALUES
  ('00000000-0000-4000-8000-000000000001', 'patient'),
  ('00000000-0000-4000-8000-000000000002', 'patient'),
  ('00000000-0000-4000-8000-000000000003', 'provider'),
  ('00000000-0000-4000-8000-000000000004', 'admin');

CREATE TABLE app.session (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app.user_test (id),
  family_id uuid NOT NULL,
  refresh_token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX session_by_user ON app.session (user_id) WHERE revoked_at IS NULL;
COMMENT ON COLUMN app.session.id IS 'class=Internal';
COMMENT ON COLUMN app.session.user_id IS 'class=Internal';
COMMENT ON COLUMN app.session.family_id IS 'class=Internal';
COMMENT ON COLUMN app.session.refresh_token_hash IS 'class=Confidential';
COMMENT ON COLUMN app.session.created_at IS 'class=Internal';
COMMENT ON COLUMN app.session.expires_at IS 'class=Internal';
COMMENT ON COLUMN app.session.revoked_at IS 'class=Internal';

CREATE TABLE app.patient_note (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES app.user_test (id),
  body app.encrypted_field NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patient_note_owner ON app.patient_note (owner_id, created_at DESC);
COMMENT ON COLUMN app.patient_note.id IS 'class=Internal';
COMMENT ON COLUMN app.patient_note.owner_id IS 'class=Internal';
COMMENT ON COLUMN app.patient_note.body IS 'class=Restricted';
COMMENT ON COLUMN app.patient_note.created_at IS 'class=Internal';
