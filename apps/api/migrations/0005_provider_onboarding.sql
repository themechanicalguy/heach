-- Up Migration
-- Provider onboarding (Step 3, J1 and J5): documents on the role checklist (PO-01, PO-02), the
-- identity check result without any Aadhaar number (KY-01, KY-05), payout details (PO-06) and
-- the admin's review decisions (AD-02). Every column carries its data class (DC-01.1).

-- A stored file. The bytes live in object storage, encrypted with their own data key in the
-- documents domain (EN-07); the row says where, and whether the scanner passed it.
CREATE TABLE app.stored_object (
  id uuid PRIMARY KEY,
  owner_account_id uuid NOT NULL REFERENCES app.account (id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN (
    'provider_document', 'booking_attachment', 'visit_record', 'lab_report', 'vault_upload'
  )),
  content_type text NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  scan_status text NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'infected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stored_object_by_owner ON app.stored_object (owner_account_id);
COMMENT ON COLUMN app.stored_object.id IS 'class=Internal';
COMMENT ON COLUMN app.stored_object.owner_account_id IS 'class=Internal';
COMMENT ON COLUMN app.stored_object.purpose IS 'class=Internal';
COMMENT ON COLUMN app.stored_object.content_type IS 'class=Internal';
COMMENT ON COLUMN app.stored_object.size_bytes IS 'class=Internal';
COMMENT ON COLUMN app.stored_object.scan_status IS 'class=Internal';
COMMENT ON COLUMN app.stored_object.created_at IS 'class=Internal';

-- One document per checklist item and provider; a new upload replaces the old one.
CREATE TABLE app.provider_document (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES app.account (id) ON DELETE CASCADE,
  item text NOT NULL CHECK (item ~ '^[a-z_]{1,40}$'),
  object_id uuid NOT NULL REFERENCES app.stored_object (id),
  -- Registration or certificate number as printed on the document.
  reference text CHECK (char_length(reference) BETWEEN 1 AND 60),
  expires_on date,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN (
    'pending', 'accepted', 'rejected'
  )),
  review_reason text CHECK (review_reason ~ '^[a-z_]{1,40}$'),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, item),
  CHECK (review_status <> 'rejected' OR review_reason IS NOT NULL)
);
COMMENT ON COLUMN app.provider_document.id IS 'class=Internal';
COMMENT ON COLUMN app.provider_document.account_id IS 'class=Internal';
COMMENT ON COLUMN app.provider_document.item IS 'class=Internal';
COMMENT ON COLUMN app.provider_document.object_id IS 'class=Internal';
COMMENT ON COLUMN app.provider_document.reference IS 'class=Confidential';
COMMENT ON COLUMN app.provider_document.expires_on IS 'class=Confidential';
COMMENT ON COLUMN app.provider_document.review_status IS 'class=Internal';
COMMENT ON COLUMN app.provider_document.review_reason IS 'class=Internal';
COMMENT ON COLUMN app.provider_document.uploaded_at IS 'class=Internal';

-- The outcome of the identity partner's check. The Aadhaar number never reaches us (KY-05).
CREATE TABLE app.identity_check (
  account_id uuid PRIMARY KEY REFERENCES app.account (id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'verified', 'failed')),
  method text CHECK (method IN ('aadhaar', 'digilocker', 'manual')),
  reference text NOT NULL CHECK (char_length(reference) BETWEEN 8 AND 80),
  checked_at timestamptz,
  CHECK ((status = 'pending') = (checked_at IS NULL))
);
COMMENT ON COLUMN app.identity_check.account_id IS 'class=Internal';
COMMENT ON COLUMN app.identity_check.status IS 'class=Confidential';
COMMENT ON COLUMN app.identity_check.method IS 'class=Confidential';
COMMENT ON COLUMN app.identity_check.reference IS 'class=Internal';
COMMENT ON COLUMN app.identity_check.checked_at IS 'class=Confidential';

-- Where the provider is paid (PO-06). The account number and UPI ID are Restricted.
CREATE TABLE app.payout_account (
  account_id uuid PRIMARY KEY REFERENCES app.account (id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('bank', 'upi')),
  holder_name text NOT NULL CHECK (char_length(holder_name) BETWEEN 1 AND 100),
  destination app.encrypted_field NOT NULL,
  -- Shown back to the provider so they can recognise it: last four characters only.
  destination_hint text NOT NULL CHECK (char_length(destination_hint) BETWEEN 1 AND 4),
  ifsc text CHECK (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((method = 'bank') = (ifsc IS NOT NULL))
);
COMMENT ON COLUMN app.payout_account.account_id IS 'class=Internal';
COMMENT ON COLUMN app.payout_account.method IS 'class=Confidential';
COMMENT ON COLUMN app.payout_account.holder_name IS 'class=Confidential';
COMMENT ON COLUMN app.payout_account.destination IS 'class=Restricted';
COMMENT ON COLUMN app.payout_account.destination_hint IS 'class=Confidential';
COMMENT ON COLUMN app.payout_account.ifsc IS 'class=Confidential';
COMMENT ON COLUMN app.payout_account.updated_at IS 'class=Internal';

-- Every status change of a provider application, by whom and why (AD-02, AD-11).
CREATE TABLE app.application_event (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES app.account (id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  reason text CHECK (reason ~ '^[a-z_]{1,40}$'),
  actor_id uuid,
  actor_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX application_event_by_account ON app.application_event (account_id, created_at);
COMMENT ON COLUMN app.application_event.id IS 'class=Internal';
COMMENT ON COLUMN app.application_event.account_id IS 'class=Internal';
COMMENT ON COLUMN app.application_event.from_status IS 'class=Internal';
COMMENT ON COLUMN app.application_event.to_status IS 'class=Internal';
COMMENT ON COLUMN app.application_event.reason IS 'class=Internal';
COMMENT ON COLUMN app.application_event.actor_id IS 'class=Internal';
COMMENT ON COLUMN app.application_event.actor_role IS 'class=Internal';
COMMENT ON COLUMN app.application_event.created_at IS 'class=Internal';
