-- Up Migration
-- AD-12: assisted onboarding. A support or super admin acts on a provider's behalf only inside a
-- time-limited session opened with a code the provider reads out. No phone number is kept here:
-- before consent it lives only in the encrypted OTP challenge; afterwards the session names the account.
CREATE TABLE app.assisted_session (
  id uuid PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES app.admin_account (id),
  account_id uuid REFERENCES app.account (id) ON DELETE CASCADE,
  consent_challenge_id uuid NOT NULL UNIQUE,
  locale text NOT NULL CHECK (locale IN ('or', 'en', 'hi')),
  created_at timestamptz NOT NULL DEFAULT now(),
  consented_at timestamptz,
  expires_at timestamptz NOT NULL,
  account_created boolean NOT NULL DEFAULT false,
  -- The second code (PO-06) is bound to the session and to one payout save.
  payout_challenge_id uuid,
  payout_saved_at timestamptz,
  ended_at timestamptz,
  end_reason text CHECK (end_reason IN ('submitted', 'ended', 'refused')),
  CHECK ((consented_at IS NULL) = (account_id IS NULL)),
  CHECK ((ended_at IS NULL) = (end_reason IS NULL)),
  CHECK (payout_challenge_id IS NULL OR consented_at IS NOT NULL),
  CHECK (expires_at > created_at)
);
CREATE INDEX assisted_session_by_account ON app.assisted_session (account_id, admin_id)
  WHERE consented_at IS NOT NULL;
CREATE INDEX assisted_session_open_by_admin ON app.assisted_session (admin_id)
  WHERE ended_at IS NULL;
COMMENT ON COLUMN app.assisted_session.id IS 'class=Internal';
COMMENT ON COLUMN app.assisted_session.admin_id IS 'class=Internal';
COMMENT ON COLUMN app.assisted_session.account_id IS 'class=Internal';
COMMENT ON COLUMN app.assisted_session.consent_challenge_id IS 'class=Internal';
COMMENT ON COLUMN app.assisted_session.locale IS 'class=Confidential';
COMMENT ON COLUMN app.assisted_session.created_at IS 'class=Internal';
COMMENT ON COLUMN app.assisted_session.consented_at IS 'class=Confidential';
COMMENT ON COLUMN app.assisted_session.expires_at IS 'class=Internal';
COMMENT ON COLUMN app.assisted_session.account_created IS 'class=Internal';
COMMENT ON COLUMN app.assisted_session.payout_challenge_id IS 'class=Internal';
COMMENT ON COLUMN app.assisted_session.payout_saved_at IS 'class=Internal';
COMMENT ON COLUMN app.assisted_session.ended_at IS 'class=Internal';
COMMENT ON COLUMN app.assisted_session.end_reason IS 'class=Internal';
-- Evidence of who assisted whom (separation of duties): the API may not delete it.
REVOKE DELETE ON app.assisted_session FROM heach_app;

-- Identity consent given through an assisted session (KY-01, PR-01).
ALTER TABLE app.consent_record
  ADD COLUMN assisted_session_id uuid REFERENCES app.assisted_session (id);
COMMENT ON COLUMN app.consent_record.assisted_session_id IS 'class=Internal';

-- Two OTP purposes: consent to assistance (no account yet) and the payout code (bound to the account).
ALTER TABLE app.otp_challenge DROP CONSTRAINT otp_challenge_purpose_check;
ALTER TABLE app.otp_challenge ADD CONSTRAINT otp_challenge_purpose_check
  CHECK (purpose IN ('sign_in', 'reverify', 'change_mobile', 'assisted_consent', 'assisted_payout'));
ALTER TABLE app.otp_challenge DROP CONSTRAINT otp_challenge_account_presence;
ALTER TABLE app.otp_challenge ADD CONSTRAINT otp_challenge_account_presence
  CHECK ((purpose IN ('sign_in', 'assisted_consent')) = (account_id IS NULL));
