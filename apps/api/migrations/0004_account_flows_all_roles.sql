-- Up Migration
-- Account flows for every role (docs/account-flows-all-roles.md): linked patients (AC-03),
-- deletion requests (AC-06, PR-04), phone-number change by OTP, organisations and staff
-- memberships (owner decision O-1), and admin password change and recovery (O-2). Every column
-- carries its data class (DC-01.1); retention is in the work record.

-- Dependent profiles a care account books for; they have no sign-in of their own (default D-1).
CREATE TABLE app.linked_patient (
  id uuid PRIMARY KEY,
  owner_account_id uuid NOT NULL REFERENCES app.account (id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 100),
  birth_year smallint NOT NULL CHECK (birth_year BETWEEN 1900 AND 2100),
  gender text NOT NULL CHECK (gender IN ('female', 'male', 'other', 'undisclosed')),
  relationship text NOT NULL CHECK (relationship IN (
    'parent', 'child', 'spouse', 'sibling', 'grandparent', 'grandchild', 'other_relative', 'other'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX linked_patient_by_owner ON app.linked_patient (owner_account_id);
COMMENT ON COLUMN app.linked_patient.id IS 'class=Internal';
COMMENT ON COLUMN app.linked_patient.owner_account_id IS 'class=Internal';
COMMENT ON COLUMN app.linked_patient.full_name IS 'class=Confidential';
COMMENT ON COLUMN app.linked_patient.birth_year IS 'class=Confidential';
COMMENT ON COLUMN app.linked_patient.gender IS 'class=Confidential';
COMMENT ON COLUMN app.linked_patient.relationship IS 'class=Confidential';
COMMENT ON COLUMN app.linked_patient.created_at IS 'class=Internal';
COMMENT ON COLUMN app.linked_patient.updated_at IS 'class=Internal';

-- A request to erase the account's data (default D-3). Carrying it out waits on the lawyer.
CREATE TABLE app.deletion_request (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES app.account (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cancelled', 'completed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CHECK ((status = 'pending') = (closed_at IS NULL))
);
-- One open request per account; a repeated submission finds the open one.
CREATE UNIQUE INDEX deletion_request_one_open ON app.deletion_request (account_id)
  WHERE status = 'pending';
COMMENT ON COLUMN app.deletion_request.id IS 'class=Internal';
COMMENT ON COLUMN app.deletion_request.account_id IS 'class=Internal';
COMMENT ON COLUMN app.deletion_request.status IS 'class=Internal';
COMMENT ON COLUMN app.deletion_request.requested_at IS 'class=Internal';
COMMENT ON COLUMN app.deletion_request.closed_at IS 'class=Internal';

-- A lab or a clinic, owned by the provider account that runs it (O-1). It is approved when its
-- owner's provider application is approved; until then members get sign-in only.
CREATE TABLE app.organisation (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('lab', 'clinic')),
  owner_account_id uuid NOT NULL UNIQUE REFERENCES app.account (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN app.organisation.id IS 'class=Internal';
COMMENT ON COLUMN app.organisation.kind IS 'class=Internal';
COMMENT ON COLUMN app.organisation.owner_account_id IS 'class=Internal';
COMMENT ON COLUMN app.organisation.name IS 'class=Confidential';
COMMENT ON COLUMN app.organisation.created_at IS 'class=Internal';

-- Staff of an organisation (O-1): invited by mobile number, bound to an account on acceptance.
-- An invitation past expires_at counts as expired whatever its stored status.
CREATE TABLE app.membership (
  id uuid PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES app.organisation (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('clinic_front_desk', 'sample_collector')),
  invited_mobile app.encrypted_field NOT NULL,
  invited_mobile_index text NOT NULL,
  account_id uuid REFERENCES app.account (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN (
    'invited', 'active', 'declined', 'revoked', 'removed', 'expired'
  )),
  invited_by uuid REFERENCES app.account (id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  ended_at timestamptz,
  CHECK ((status = 'active') = (account_id IS NOT NULL AND accepted_at IS NOT NULL)),
  CHECK ((status IN ('invited', 'active')) = (ended_at IS NULL))
);
-- One open invitation or membership per organisation and number; one active membership per
-- account (an account holds one provider role).
CREATE UNIQUE INDEX membership_one_open ON app.membership (organisation_id, invited_mobile_index)
  WHERE status IN ('invited', 'active');
CREATE UNIQUE INDEX membership_one_active ON app.membership (account_id) WHERE status = 'active';
CREATE INDEX membership_by_mobile ON app.membership (invited_mobile_index)
  WHERE status = 'invited';
COMMENT ON COLUMN app.membership.id IS 'class=Internal';
COMMENT ON COLUMN app.membership.organisation_id IS 'class=Internal';
COMMENT ON COLUMN app.membership.role IS 'class=Internal';
COMMENT ON COLUMN app.membership.invited_mobile IS 'class=Confidential';
COMMENT ON COLUMN app.membership.invited_mobile_index IS 'class=Confidential';
COMMENT ON COLUMN app.membership.account_id IS 'class=Internal';
COMMENT ON COLUMN app.membership.status IS 'class=Internal';
COMMENT ON COLUMN app.membership.invited_by IS 'class=Internal';
COMMENT ON COLUMN app.membership.invited_at IS 'class=Internal';
COMMENT ON COLUMN app.membership.expires_at IS 'class=Internal';
COMMENT ON COLUMN app.membership.accepted_at IS 'class=Internal';
COMMENT ON COLUMN app.membership.ended_at IS 'class=Internal';

-- A new account may choose an invitation instead of a self-registrable role during setup.
ALTER TABLE app.account_profile
  ADD COLUMN setup_invitation_id uuid REFERENCES app.membership (id) ON DELETE SET NULL;
COMMENT ON COLUMN app.account_profile.setup_invitation_id IS 'class=Internal';

-- Front desk staff have no provider application of their own (no verification in the
-- requirements); every other provider role keeps one (PO-04).
ALTER TABLE app.role_assignment DROP CONSTRAINT role_assignment_check;
ALTER TABLE app.role_assignment ADD CONSTRAINT role_assignment_application_status_presence
  CHECK ((side = 'care' OR role = 'clinic_front_desk') = (application_status IS NULL));

-- Phone-number change (O-3): the code goes to the new number and is bound to the account.
ALTER TABLE app.otp_challenge DROP CONSTRAINT otp_challenge_purpose_check;
ALTER TABLE app.otp_challenge DROP CONSTRAINT otp_challenge_check;
ALTER TABLE app.otp_challenge ADD CONSTRAINT otp_challenge_purpose_check
  CHECK (purpose IN ('sign_in', 'reverify', 'change_mobile'));
ALTER TABLE app.otp_challenge ADD CONSTRAINT otp_challenge_account_presence
  CHECK ((purpose = 'sign_in') = (account_id IS NULL));

-- Admin recovery (O-2): a temporary password must be replaced at the next sign-in.
ALTER TABLE app.admin_account ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE app.admin_account ADD COLUMN password_changed_at timestamptz;
-- A temporary password stops working after this time, even unused.
ALTER TABLE app.admin_account ADD COLUMN password_expires_at timestamptz;
ALTER TABLE app.admin_account ADD CONSTRAINT admin_account_temporary_password_expiry
  CHECK (must_change_password = (password_expires_at IS NOT NULL));
COMMENT ON COLUMN app.admin_account.password_expires_at IS 'class=Internal';
COMMENT ON COLUMN app.admin_account.must_change_password IS 'class=Internal';
COMMENT ON COLUMN app.admin_account.password_changed_at IS 'class=Internal';
