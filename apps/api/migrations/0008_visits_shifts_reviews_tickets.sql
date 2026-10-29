-- Up Migration
-- Home services and the Stage A pilot (Step 6): the visit itself with its start code and
-- encrypted notes (HS-03, HS-04), attendant shifts with check-in and check-out (HS-05), ratings
-- and reviews (RF-01, RF-02), safety and complaint tickets with admin notes (HS-06, RF-03,
-- AD-06), provider strikes (amendment A12) and break-glass access grants (SE-03, SE-06).

-- A visit's clinical record: what was done, seen and advised (HS-04). Restricted, encrypted.
CREATE TABLE app.visit (
  booking_id uuid PRIMARY KEY REFERENCES app.booking (id) ON DELETE CASCADE,
  started_at timestamptz,
  completed_at timestamptz,
  notes app.encrypted_field,
  code_attempts smallint NOT NULL DEFAULT 0,
  CHECK (completed_at IS NULL OR (started_at IS NOT NULL AND notes IS NOT NULL))
);
COMMENT ON COLUMN app.visit.booking_id IS 'class=Internal';
COMMENT ON COLUMN app.visit.started_at IS 'class=Confidential';
COMMENT ON COLUMN app.visit.completed_at IS 'class=Confidential';
COMMENT ON COLUMN app.visit.notes IS 'class=Restricted';
COMMENT ON COLUMN app.visit.code_attempts IS 'class=Internal';

-- One row per shift of an attendant booking (HS-05).
CREATE TABLE app.shift (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES app.booking (id) ON DELETE CASCADE,
  day_index smallint NOT NULL CHECK (day_index BETWEEN 0 AND 29),
  attendant_account_id uuid NOT NULL REFERENCES app.account (id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'checked_in', 'checked_out', 'missed', 'replaced'
  )),
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  UNIQUE (booking_id, day_index),
  CHECK (ends_at > starts_at)
);
COMMENT ON COLUMN app.shift.id IS 'class=Internal';
COMMENT ON COLUMN app.shift.booking_id IS 'class=Internal';
COMMENT ON COLUMN app.shift.day_index IS 'class=Internal';
COMMENT ON COLUMN app.shift.attendant_account_id IS 'class=Internal';
COMMENT ON COLUMN app.shift.starts_at IS 'class=Confidential';
COMMENT ON COLUMN app.shift.ends_at IS 'class=Confidential';
COMMENT ON COLUMN app.shift.status IS 'class=Internal';
COMMENT ON COLUMN app.shift.checked_in_at IS 'class=Confidential';
COMMENT ON COLUMN app.shift.checked_out_at IS 'class=Confidential';

-- Earnings per visit or per shift (PK-07: payouts released per completed session).
DROP INDEX app.ledger_one_earning;
ALTER TABLE app.ledger_entry ADD COLUMN session_key text NOT NULL DEFAULT 'visit'
  CHECK (session_key ~ '^(visit|shift:[0-9]{1,2})$');
COMMENT ON COLUMN app.ledger_entry.session_key IS 'class=Internal';
CREATE UNIQUE INDEX ledger_one_earning ON app.ledger_entry (booking_id, kind, session_key)
  WHERE kind IN ('earning', 'no_show_fee');

-- One rating per completed booking (RF-01); hidden by an admin with a reason (RF-02).
CREATE TABLE app.review (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL UNIQUE REFERENCES app.booking (id) ON DELETE CASCADE,
  patient_account_id uuid NOT NULL REFERENCES app.account (id),
  provider_account_id uuid NOT NULL REFERENCES app.account (id),
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text CHECK (char_length(comment) BETWEEN 1 AND 500),
  reported boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  hidden_reason text CHECK (hidden_reason ~ '^[a-z_]{1,40}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (hidden = (hidden_reason IS NOT NULL))
);
CREATE INDEX review_by_provider ON app.review (provider_account_id) WHERE NOT hidden;
COMMENT ON COLUMN app.review.id IS 'class=Public';
COMMENT ON COLUMN app.review.booking_id IS 'class=Internal';
COMMENT ON COLUMN app.review.patient_account_id IS 'class=Internal';
COMMENT ON COLUMN app.review.provider_account_id IS 'class=Public';
COMMENT ON COLUMN app.review.stars IS 'class=Public';
COMMENT ON COLUMN app.review.comment IS 'class=Public';
COMMENT ON COLUMN app.review.reported IS 'class=Internal';
COMMENT ON COLUMN app.review.hidden IS 'class=Public';
COMMENT ON COLUMN app.review.hidden_reason IS 'class=Internal';
COMMENT ON COLUMN app.review.created_at IS 'class=Public';

-- Safety concerns, complaints and help requests (HS-06, RF-03, AD-06).
CREATE TABLE app.ticket (
  id uuid PRIMARY KEY,
  booking_id uuid REFERENCES app.booking (id) ON DELETE SET NULL,
  raised_by uuid REFERENCES app.account (id) ON DELETE SET NULL,
  raised_by_role text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('safety', 'complaint', 'help', 'strike_review')),
  priority text NOT NULL CHECK (priority IN ('p0', 'high', 'normal')),
  topic text NOT NULL CHECK (topic ~ '^[a-z_]{1,40}$'),
  description app.encrypted_field,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'resolved')),
  assignee_admin_id uuid,
  resolution text CHECK (resolution ~ '^[a-z_]{1,40}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'resolved') = (resolution IS NOT NULL))
);
CREATE INDEX ticket_open ON app.ticket (priority, created_at) WHERE status <> 'resolved';
CREATE INDEX ticket_by_raiser ON app.ticket (raised_by, created_at DESC);
COMMENT ON COLUMN app.ticket.id IS 'class=Internal';
COMMENT ON COLUMN app.ticket.booking_id IS 'class=Internal';
COMMENT ON COLUMN app.ticket.raised_by IS 'class=Internal';
COMMENT ON COLUMN app.ticket.raised_by_role IS 'class=Internal';
COMMENT ON COLUMN app.ticket.kind IS 'class=Internal';
COMMENT ON COLUMN app.ticket.priority IS 'class=Internal';
COMMENT ON COLUMN app.ticket.topic IS 'class=Internal';
COMMENT ON COLUMN app.ticket.description IS 'class=Restricted';
COMMENT ON COLUMN app.ticket.status IS 'class=Internal';
COMMENT ON COLUMN app.ticket.assignee_admin_id IS 'class=Internal';
COMMENT ON COLUMN app.ticket.resolution IS 'class=Internal';
COMMENT ON COLUMN app.ticket.created_at IS 'class=Internal';
COMMENT ON COLUMN app.ticket.updated_at IS 'class=Internal';

CREATE TABLE app.ticket_note (
  id uuid PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES app.ticket (id) ON DELETE CASCADE,
  admin_id uuid NOT NULL,
  body app.encrypted_field NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_note_by_ticket ON app.ticket_note (ticket_id, created_at);
COMMENT ON COLUMN app.ticket_note.id IS 'class=Internal';
COMMENT ON COLUMN app.ticket_note.ticket_id IS 'class=Internal';
COMMENT ON COLUMN app.ticket_note.admin_id IS 'class=Internal';
COMMENT ON COLUMN app.ticket_note.body IS 'class=Restricted';
COMMENT ON COLUMN app.ticket_note.created_at IS 'class=Internal';

-- A provider's late cancellation or no-show (amendment A12); three open a suspension review.
CREATE TABLE app.provider_strike (
  id uuid PRIMARY KEY,
  provider_account_id uuid NOT NULL REFERENCES app.account (id),
  booking_id uuid NOT NULL UNIQUE REFERENCES app.booking (id),
  reason text NOT NULL CHECK (reason IN ('late_cancellation', 'no_show')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX provider_strike_by_provider ON app.provider_strike (provider_account_id);
COMMENT ON COLUMN app.provider_strike.id IS 'class=Internal';
COMMENT ON COLUMN app.provider_strike.provider_account_id IS 'class=Internal';
COMMENT ON COLUMN app.provider_strike.booking_id IS 'class=Internal';
COMMENT ON COLUMN app.provider_strike.reason IS 'class=Internal';
COMMENT ON COLUMN app.provider_strike.created_at IS 'class=Internal';

-- Break-glass (SE-03): an admin's time-limited access to one ticket's Restricted content, with a
-- reason; the patient can see these (SE-06).
CREATE TABLE app.access_grant (
  id uuid PRIMARY KEY,
  admin_id uuid NOT NULL,
  admin_role text NOT NULL,
  ticket_id uuid NOT NULL REFERENCES app.ticket (id) ON DELETE CASCADE,
  subject_account_id uuid REFERENCES app.account (id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason ~ '^[a-z_]{1,40}$'),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > granted_at)
);
CREATE INDEX access_grant_by_subject ON app.access_grant (subject_account_id, granted_at DESC);
COMMENT ON COLUMN app.access_grant.id IS 'class=Internal';
COMMENT ON COLUMN app.access_grant.admin_id IS 'class=Internal';
COMMENT ON COLUMN app.access_grant.admin_role IS 'class=Internal';
COMMENT ON COLUMN app.access_grant.ticket_id IS 'class=Internal';
COMMENT ON COLUMN app.access_grant.subject_account_id IS 'class=Internal';
COMMENT ON COLUMN app.access_grant.reason IS 'class=Internal';
COMMENT ON COLUMN app.access_grant.granted_at IS 'class=Internal';
COMMENT ON COLUMN app.access_grant.expires_at IS 'class=Internal';
