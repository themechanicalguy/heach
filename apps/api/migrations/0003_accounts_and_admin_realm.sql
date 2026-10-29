-- Up Migration
-- Accounts, roles, consent and OTP challenges for patients and providers; admin accounts in their
-- own realm. Replaces the Step 2 app.user_test: its synthetic patients and provider become
-- synthetic accounts (no mobile number; only test sign-in reaches them). Every column carries its
-- data class (DC-01.1); retention is in docs/login-and-account-setup.md.

CREATE TABLE app.account (
  id uuid PRIMARY KEY,
  -- Encrypted in the identity domain and looked up by blind index (EN-09, decision L-7).
  mobile app.encrypted_field,
  mobile_index text UNIQUE,
  synthetic boolean NOT NULL DEFAULT false,
  preferred_locale text NOT NULL DEFAULT 'or' CHECK (preferred_locale IN ('or', 'en', 'hi')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  suspension_reason text CHECK (
    suspension_reason IN ('safety_concern', 'fraud', 'policy_breach', 'user_request', 'other')
  ),
  setup_completed_at timestamptz,
  -- The side the user last worked on; sign-in starts there if the role is still granted.
  last_active_role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sign_in_at timestamptz,
  CHECK (synthetic OR (mobile IS NOT NULL AND mobile_index IS NOT NULL)),
  CHECK ((status = 'suspended') = (suspension_reason IS NOT NULL))
);
COMMENT ON COLUMN app.account.id IS 'class=Internal';
COMMENT ON COLUMN app.account.mobile IS 'class=Confidential';
COMMENT ON COLUMN app.account.mobile_index IS 'class=Confidential';
COMMENT ON COLUMN app.account.synthetic IS 'class=Internal';
COMMENT ON COLUMN app.account.preferred_locale IS 'class=Internal';
COMMENT ON COLUMN app.account.status IS 'class=Internal';
COMMENT ON COLUMN app.account.suspension_reason IS 'class=Internal';
COMMENT ON COLUMN app.account.setup_completed_at IS 'class=Internal';
COMMENT ON COLUMN app.account.last_active_role IS 'class=Internal';
COMMENT ON COLUMN app.account.created_at IS 'class=Internal';
COMMENT ON COLUMN app.account.last_sign_in_at IS 'class=Internal';

-- Basic details from account setup, saved step by step so setup can be resumed (decision L-5).
-- setup_role is only the role the user asked for; the server grants roles in role_assignment.
CREATE TABLE app.account_profile (
  account_id uuid PRIMARY KEY REFERENCES app.account (id) ON DELETE CASCADE,
  full_name text CHECK (char_length(full_name) BETWEEN 1 AND 100),
  gender text CHECK (gender IN ('female', 'male', 'other', 'undisclosed')),
  languages text[] NOT NULL DEFAULT '{}' CHECK (languages <@ ARRAY['or', 'en', 'hi']),
  organisation_name text CHECK (char_length(organisation_name) BETWEEN 1 AND 120),
  adult_declared_at timestamptz,
  setup_role text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN app.account_profile.account_id IS 'class=Internal';
COMMENT ON COLUMN app.account_profile.full_name IS 'class=Confidential';
COMMENT ON COLUMN app.account_profile.gender IS 'class=Confidential';
COMMENT ON COLUMN app.account_profile.languages IS 'class=Confidential';
COMMENT ON COLUMN app.account_profile.organisation_name IS 'class=Confidential';
COMMENT ON COLUMN app.account_profile.adult_declared_at IS 'class=Confidential';
COMMENT ON COLUMN app.account_profile.setup_role IS 'class=Internal';
COMMENT ON COLUMN app.account_profile.updated_at IS 'class=Internal';

-- At most one care role and one provider role per account (requirements, users and roles).
-- application_status is the provider application's state (PO-04); care roles have none.
CREATE TABLE app.role_assignment (
  account_id uuid NOT NULL REFERENCES app.account (id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('care', 'provider')),
  role text NOT NULL,
  application_status text CHECK (application_status IN (
    'draft', 'submitted', 'under_review', 'changes_requested', 'approved', 'rejected', 'suspended'
  )),
  status_reason text CHECK (status_reason ~ '^[a-z_]{1,40}$'),
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by text NOT NULL,
  PRIMARY KEY (account_id, side),
  CHECK ((side = 'care') = (application_status IS NULL)),
  CHECK (side <> 'care' OR role IN ('patient', 'representative')),
  CHECK (side <> 'provider' OR role IN (
    'doctor', 'dentist', 'dermatologist', 'physiotherapist', 'nurse', 'attendant', 'lab',
    'sample_collector', 'clinic_front_desk'
  ))
);
COMMENT ON COLUMN app.role_assignment.account_id IS 'class=Internal';
COMMENT ON COLUMN app.role_assignment.side IS 'class=Internal';
COMMENT ON COLUMN app.role_assignment.role IS 'class=Internal';
COMMENT ON COLUMN app.role_assignment.application_status IS 'class=Internal';
COMMENT ON COLUMN app.role_assignment.status_reason IS 'class=Internal';
COMMENT ON COLUMN app.role_assignment.granted_at IS 'class=Internal';
COMMENT ON COLUMN app.role_assignment.granted_by IS 'class=Internal';

-- Versioned consent (PR-01, decision L-12). Kept after withdrawal as evidence.
CREATE TABLE app.consent_record (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES app.account (id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('terms', 'privacy')),
  version text NOT NULL CHECK (version ~ '^[a-z0-9.-]{1,40}$'),
  locale text NOT NULL CHECK (locale IN ('or', 'en', 'hi')),
  given_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz
);
-- A repeated submission of the same consent is a no-op, not a second record.
CREATE UNIQUE INDEX consent_record_once ON app.consent_record (account_id, purpose, version)
  WHERE withdrawn_at IS NULL;
COMMENT ON COLUMN app.consent_record.id IS 'class=Internal';
COMMENT ON COLUMN app.consent_record.account_id IS 'class=Internal';
COMMENT ON COLUMN app.consent_record.purpose IS 'class=Confidential';
COMMENT ON COLUMN app.consent_record.version IS 'class=Confidential';
COMMENT ON COLUMN app.consent_record.locale IS 'class=Confidential';
COMMENT ON COLUMN app.consent_record.given_at IS 'class=Confidential';
COMMENT ON COLUMN app.consent_record.withdrawn_at IS 'class=Confidential';

-- One-time passwords (decision L-6): only a keyed hash of the code is kept. Rows are purged 24
-- hours after they expire.
CREATE TABLE app.otp_challenge (
  id uuid PRIMARY KEY,
  purpose text NOT NULL CHECK (purpose IN ('sign_in', 'reverify')),
  mobile app.encrypted_field NOT NULL,
  mobile_index text NOT NULL,
  account_id uuid REFERENCES app.account (id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  resends integer NOT NULL DEFAULT 0 CHECK (resends >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  resend_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CHECK ((purpose = 'reverify') = (account_id IS NOT NULL))
);
CREATE INDEX otp_challenge_expiry ON app.otp_challenge (expires_at);
COMMENT ON COLUMN app.otp_challenge.id IS 'class=Internal';
COMMENT ON COLUMN app.otp_challenge.purpose IS 'class=Internal';
COMMENT ON COLUMN app.otp_challenge.mobile IS 'class=Confidential';
COMMENT ON COLUMN app.otp_challenge.mobile_index IS 'class=Confidential';
COMMENT ON COLUMN app.otp_challenge.account_id IS 'class=Internal';
COMMENT ON COLUMN app.otp_challenge.code_hash IS 'class=Internal';
COMMENT ON COLUMN app.otp_challenge.attempts IS 'class=Internal';
COMMENT ON COLUMN app.otp_challenge.resends IS 'class=Internal';
COMMENT ON COLUMN app.otp_challenge.created_at IS 'class=Internal';
COMMENT ON COLUMN app.otp_challenge.expires_at IS 'class=Internal';
COMMENT ON COLUMN app.otp_challenge.resend_at IS 'class=Internal';
COMMENT ON COLUMN app.otp_challenge.consumed_at IS 'class=Internal';

-- Step 2 identities move over. Their sessions are dropped: everyone signs in again.
INSERT INTO app.account (id, synthetic, setup_completed_at)
  SELECT id, true, now() FROM app.user_test WHERE role IN ('patient', 'provider');
INSERT INTO app.account_profile (account_id) SELECT id FROM app.account;
INSERT INTO app.role_assignment (account_id, side, role, application_status, granted_by)
  SELECT id, 'care', 'patient', NULL, 'migration' FROM app.user_test WHERE role = 'patient'
  UNION ALL
  SELECT id, 'provider', 'nurse', 'approved', 'migration' FROM app.user_test WHERE role = 'provider';

DELETE FROM app.session;
ALTER TABLE app.session DROP CONSTRAINT session_user_id_fkey;
ALTER TABLE app.session ADD FOREIGN KEY (user_id) REFERENCES app.account (id) ON DELETE CASCADE;
ALTER TABLE app.session ADD COLUMN active_role text NOT NULL;
ALTER TABLE app.session ADD COLUMN family_started_at timestamptz NOT NULL;
COMMENT ON COLUMN app.session.active_role IS 'class=Internal';
COMMENT ON COLUMN app.session.family_started_at IS 'class=Internal';

ALTER TABLE app.patient_note DROP CONSTRAINT patient_note_owner_id_fkey;
ALTER TABLE app.patient_note ADD FOREIGN KEY (owner_id) REFERENCES app.account (id);
DROP TABLE app.user_test;

-- Admin realm (decision L-9). The password hash is a salted scrypt hash (Confidential, L-14);
-- the TOTP secret is Restricted and field-encrypted.
CREATE TABLE app.admin_account (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE CHECK (email = lower(email) AND char_length(email) <= 254),
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin', 'verifier', 'support', 'finance')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  totp_secret app.encrypted_field,
  totp_enrolled_at timestamptz,
  totp_last_step bigint,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sign_in_at timestamptz,
  CHECK (totp_enrolled_at IS NULL OR totp_secret IS NOT NULL)
);
COMMENT ON COLUMN app.admin_account.id IS 'class=Internal';
COMMENT ON COLUMN app.admin_account.email IS 'class=Confidential';
COMMENT ON COLUMN app.admin_account.password_hash IS 'class=Confidential';
COMMENT ON COLUMN app.admin_account.role IS 'class=Internal';
COMMENT ON COLUMN app.admin_account.status IS 'class=Internal';
COMMENT ON COLUMN app.admin_account.totp_secret IS 'class=Restricted';
COMMENT ON COLUMN app.admin_account.totp_enrolled_at IS 'class=Internal';
COMMENT ON COLUMN app.admin_account.totp_last_step IS 'class=Internal';
COMMENT ON COLUMN app.admin_account.failed_attempts IS 'class=Internal';
COMMENT ON COLUMN app.admin_account.locked_until IS 'class=Internal';
COMMENT ON COLUMN app.admin_account.created_at IS 'class=Internal';
COMMENT ON COLUMN app.admin_account.last_sign_in_at IS 'class=Internal';

-- Same shape as app.session, so one session implementation serves both realms (decision L-10);
-- user_id here is the admin account.
CREATE TABLE app.admin_session (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app.admin_account (id) ON DELETE CASCADE,
  family_id uuid NOT NULL,
  refresh_token_hash text NOT NULL UNIQUE,
  active_role text NOT NULL,
  family_started_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX admin_session_by_user ON app.admin_session (user_id) WHERE revoked_at IS NULL;
COMMENT ON COLUMN app.admin_session.id IS 'class=Internal';
COMMENT ON COLUMN app.admin_session.user_id IS 'class=Internal';
COMMENT ON COLUMN app.admin_session.family_id IS 'class=Internal';
COMMENT ON COLUMN app.admin_session.refresh_token_hash IS 'class=Confidential';
COMMENT ON COLUMN app.admin_session.active_role IS 'class=Internal';
COMMENT ON COLUMN app.admin_session.family_started_at IS 'class=Internal';
COMMENT ON COLUMN app.admin_session.created_at IS 'class=Internal';
COMMENT ON COLUMN app.admin_session.expires_at IS 'class=Internal';
COMMENT ON COLUMN app.admin_session.revoked_at IS 'class=Internal';
