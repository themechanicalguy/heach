-- Up Migration
-- Booking, payments and notifications (Step 5): bookings with their event history (BK-01 to
-- BK-04), "any available provider" offers (amendment A10), gateway payments, refunds and
-- webhook events (PY-01, PY-02), the provider earnings ledger and payout runs (PY-04, PY-05),
-- a durable job table for timers (decision D-QUEUE: PostgreSQL, no new dependency), in-app
-- notifications (NT-02) and the settings operations change (AD-08).

-- Operations settings with their defaults (AD-08; owner decisions Q-COMMISSION, Q-ADVANCE).
CREATE TABLE app.setting (
  key text PRIMARY KEY CHECK (key ~ '^[a-z_]{2,60}$'),
  value integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN app.setting.key IS 'class=Internal';
COMMENT ON COLUMN app.setting.value IS 'class=Internal';
COMMENT ON COLUMN app.setting.updated_at IS 'class=Internal';
INSERT INTO app.setting (key, value) VALUES
  ('acceptance_window_minutes', 30),
  ('commission_bps', 1500),
  ('attendant_advance_percent', 30),
  ('free_cancellation_hours', 24),
  ('late_cancellation_refund_percent', 50),
  ('dispatch_wave_size', 3),
  ('dispatch_wave_minutes', 10),
  ('payout_hold_hours', 48),
  ('patient_no_show_fee_percent', 50),
  ('no_show_wait_minutes', 15);

CREATE TABLE app.booking (
  id uuid PRIMARY KEY,
  -- BK-01: booker, care recipient (a linked patient, or the booker), provider, service, slot.
  booker_account_id uuid NOT NULL REFERENCES app.account (id),
  linked_patient_id uuid REFERENCES app.linked_patient (id) ON DELETE SET NULL,
  provider_account_id uuid REFERENCES app.account (id),
  item_id uuid NOT NULL REFERENCES app.catalogue_item (id),
  listing_id uuid REFERENCES app.listing (id),
  matching text NOT NULL CHECK (matching IN ('chosen', 'any')),
  status text NOT NULL CHECK (status IN (
    'pending_payment', 'requested', 'confirmed', 'in_progress', 'completed', 'cancelled',
    'no_show', 'refunded'
  )),
  cancelled_by text CHECK (cancelled_by IN ('patient', 'provider', 'admin', 'system')),
  no_show_party text CHECK (no_show_party IN ('patient', 'provider')),
  status_reason text CHECK (status_reason ~ '^[a-z_]{1,40}$'),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  shift_days smallint NOT NULL DEFAULT 1 CHECK (shift_days BETWEEN 1 AND 30),
  pin text NOT NULL REFERENCES app.pin_code (pin),
  address app.encrypted_field NOT NULL,
  notes app.encrypted_field,
  gender_preference text CHECK (gender_preference IN ('female', 'male')),
  -- Fee breakdown frozen at booking time, in paise (BK-01, PY-01).
  fee_paise integer NOT NULL CHECK (fee_paise >= 0),
  travel_paise integer NOT NULL DEFAULT 0 CHECK (travel_paise >= 0),
  discount_paise integer NOT NULL DEFAULT 0 CHECK (discount_paise >= 0),
  total_paise integer NOT NULL CHECK (total_paise >= 0),
  commission_paise integer NOT NULL CHECK (commission_paise >= 0),
  advance_paise integer NOT NULL CHECK (advance_paise >= 0),
  paid_paise integer NOT NULL DEFAULT 0 CHECK (paid_paise >= 0),
  refunded_paise integer NOT NULL DEFAULT 0 CHECK (refunded_paise >= 0),
  accept_by timestamptz,
  prescription_object_id uuid REFERENCES app.stored_object (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  completed_at timestamptz,
  CHECK (ends_at > starts_at),
  CHECK (refunded_paise <= paid_paise),
  CHECK ((status = 'cancelled') = (cancelled_by IS NOT NULL) OR status = 'refunded'),
  CHECK ((status = 'no_show') = (no_show_party IS NOT NULL) OR status = 'refunded'),
  CHECK (matching = 'any' OR provider_account_id IS NOT NULL)
);
CREATE INDEX booking_by_booker ON app.booking (booker_account_id, starts_at DESC);
CREATE INDEX booking_by_provider ON app.booking (provider_account_id, starts_at);
CREATE INDEX booking_by_status ON app.booking (status, starts_at);
COMMENT ON COLUMN app.booking.id IS 'class=Internal';
COMMENT ON COLUMN app.booking.booker_account_id IS 'class=Internal';
COMMENT ON COLUMN app.booking.linked_patient_id IS 'class=Internal';
COMMENT ON COLUMN app.booking.provider_account_id IS 'class=Internal';
COMMENT ON COLUMN app.booking.item_id IS 'class=Confidential';
COMMENT ON COLUMN app.booking.listing_id IS 'class=Internal';
COMMENT ON COLUMN app.booking.matching IS 'class=Internal';
COMMENT ON COLUMN app.booking.status IS 'class=Internal';
COMMENT ON COLUMN app.booking.cancelled_by IS 'class=Internal';
COMMENT ON COLUMN app.booking.no_show_party IS 'class=Internal';
COMMENT ON COLUMN app.booking.status_reason IS 'class=Internal';
COMMENT ON COLUMN app.booking.starts_at IS 'class=Confidential';
COMMENT ON COLUMN app.booking.ends_at IS 'class=Confidential';
COMMENT ON COLUMN app.booking.shift_days IS 'class=Internal';
COMMENT ON COLUMN app.booking.pin IS 'class=Confidential';
COMMENT ON COLUMN app.booking.address IS 'class=Restricted';
COMMENT ON COLUMN app.booking.notes IS 'class=Restricted';
COMMENT ON COLUMN app.booking.gender_preference IS 'class=Confidential';
COMMENT ON COLUMN app.booking.fee_paise IS 'class=Confidential';
COMMENT ON COLUMN app.booking.travel_paise IS 'class=Confidential';
COMMENT ON COLUMN app.booking.discount_paise IS 'class=Confidential';
COMMENT ON COLUMN app.booking.total_paise IS 'class=Confidential';
COMMENT ON COLUMN app.booking.commission_paise IS 'class=Confidential';
COMMENT ON COLUMN app.booking.advance_paise IS 'class=Confidential';
COMMENT ON COLUMN app.booking.paid_paise IS 'class=Confidential';
COMMENT ON COLUMN app.booking.refunded_paise IS 'class=Confidential';
COMMENT ON COLUMN app.booking.accept_by IS 'class=Internal';
COMMENT ON COLUMN app.booking.prescription_object_id IS 'class=Internal';
COMMENT ON COLUMN app.booking.created_at IS 'class=Internal';
COMMENT ON COLUMN app.booking.confirmed_at IS 'class=Internal';
COMMENT ON COLUMN app.booking.completed_at IS 'class=Internal';

-- Every status change: who, from, to and why (state machine rules).
CREATE TABLE app.booking_event (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES app.booking (id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  reason text CHECK (reason ~ '^[a-z_]{1,40}$'),
  actor_id text,
  actor_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX booking_event_by_booking ON app.booking_event (booking_id, created_at);
COMMENT ON COLUMN app.booking_event.id IS 'class=Internal';
COMMENT ON COLUMN app.booking_event.booking_id IS 'class=Internal';
COMMENT ON COLUMN app.booking_event.from_status IS 'class=Internal';
COMMENT ON COLUMN app.booking_event.to_status IS 'class=Internal';
COMMENT ON COLUMN app.booking_event.reason IS 'class=Internal';
COMMENT ON COLUMN app.booking_event.actor_id IS 'class=Internal';
COMMENT ON COLUMN app.booking_event.actor_role IS 'class=Internal';
COMMENT ON COLUMN app.booking_event.created_at IS 'class=Internal';

-- A request sent to one provider: the chosen one, or one of a wave (amendment A10).
CREATE TABLE app.booking_offer (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES app.booking (id) ON DELETE CASCADE,
  provider_account_id uuid NOT NULL REFERENCES app.account (id),
  listing_id uuid NOT NULL REFERENCES app.listing (id),
  wave smallint NOT NULL CHECK (wave BETWEEN 0 AND 20),
  status text NOT NULL DEFAULT 'offered' CHECK (status IN (
    'offered', 'accepted', 'declined', 'expired', 'withdrawn'
  )),
  decline_reason text CHECK (decline_reason ~ '^[a-z_]{1,40}$'),
  offered_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (booking_id, provider_account_id)
);
CREATE INDEX booking_offer_open ON app.booking_offer (provider_account_id) WHERE status = 'offered';
COMMENT ON COLUMN app.booking_offer.id IS 'class=Internal';
COMMENT ON COLUMN app.booking_offer.booking_id IS 'class=Internal';
COMMENT ON COLUMN app.booking_offer.provider_account_id IS 'class=Internal';
COMMENT ON COLUMN app.booking_offer.listing_id IS 'class=Internal';
COMMENT ON COLUMN app.booking_offer.wave IS 'class=Internal';
COMMENT ON COLUMN app.booking_offer.status IS 'class=Internal';
COMMENT ON COLUMN app.booking_offer.decline_reason IS 'class=Internal';
COMMENT ON COLUMN app.booking_offer.offered_at IS 'class=Internal';
COMMENT ON COLUMN app.booking_offer.responded_at IS 'class=Internal';

-- One gateway order per payment; the advance and the balance of a shift booking are two.
CREATE TABLE app.payment (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES app.booking (id),
  purpose text NOT NULL CHECK (purpose IN ('booking', 'balance')),
  gateway_order_id text NOT NULL UNIQUE CHECK (char_length(gateway_order_id) BETWEEN 4 AND 80),
  gateway_payment_id text UNIQUE CHECK (char_length(gateway_payment_id) BETWEEN 4 AND 80),
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  UNIQUE (booking_id, purpose)
);
COMMENT ON COLUMN app.payment.id IS 'class=Internal';
COMMENT ON COLUMN app.payment.booking_id IS 'class=Internal';
COMMENT ON COLUMN app.payment.purpose IS 'class=Internal';
COMMENT ON COLUMN app.payment.gateway_order_id IS 'class=Confidential';
COMMENT ON COLUMN app.payment.gateway_payment_id IS 'class=Confidential';
COMMENT ON COLUMN app.payment.amount_paise IS 'class=Confidential';
COMMENT ON COLUMN app.payment.status IS 'class=Internal';
COMMENT ON COLUMN app.payment.created_at IS 'class=Internal';
COMMENT ON COLUMN app.payment.paid_at IS 'class=Internal';

-- Webhook events already processed: a duplicate is acknowledged and ignored.
CREATE TABLE app.payment_event (
  gateway_event_id text PRIMARY KEY CHECK (char_length(gateway_event_id) BETWEEN 4 AND 80),
  kind text NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 40),
  received_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN app.payment_event.gateway_event_id IS 'class=Internal';
COMMENT ON COLUMN app.payment_event.kind IS 'class=Internal';
COMMENT ON COLUMN app.payment_event.received_at IS 'class=Internal';

CREATE TABLE app.refund (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES app.booking (id),
  payment_id uuid NOT NULL REFERENCES app.payment (id),
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  reason text NOT NULL CHECK (reason ~ '^[a-z_]{1,40}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  gateway_refund_id text CHECK (char_length(gateway_refund_id) BETWEEN 4 AND 80),
  actor_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX refund_by_booking ON app.refund (booking_id);
COMMENT ON COLUMN app.refund.id IS 'class=Internal';
COMMENT ON COLUMN app.refund.booking_id IS 'class=Internal';
COMMENT ON COLUMN app.refund.payment_id IS 'class=Internal';
COMMENT ON COLUMN app.refund.amount_paise IS 'class=Confidential';
COMMENT ON COLUMN app.refund.reason IS 'class=Internal';
COMMENT ON COLUMN app.refund.status IS 'class=Internal';
COMMENT ON COLUMN app.refund.gateway_refund_id IS 'class=Confidential';
COMMENT ON COLUMN app.refund.actor_role IS 'class=Internal';
COMMENT ON COLUMN app.refund.created_at IS 'class=Internal';
COMMENT ON COLUMN app.refund.processed_at IS 'class=Internal';

CREATE TABLE app.payout_run (
  id uuid PRIMARY KEY,
  run_at timestamptz NOT NULL DEFAULT now(),
  provider_count integer NOT NULL CHECK (provider_count >= 0),
  total_paise integer NOT NULL CHECK (total_paise >= 0)
);
COMMENT ON COLUMN app.payout_run.id IS 'class=Internal';
COMMENT ON COLUMN app.payout_run.run_at IS 'class=Internal';
COMMENT ON COLUMN app.payout_run.provider_count IS 'class=Internal';
COMMENT ON COLUMN app.payout_run.total_paise IS 'class=Confidential';

-- The provider's earnings ledger (PY-04): signed amounts; a payout settles available entries.
CREATE TABLE app.ledger_entry (
  id uuid PRIMARY KEY,
  provider_account_id uuid NOT NULL REFERENCES app.account (id),
  booking_id uuid REFERENCES app.booking (id),
  kind text NOT NULL CHECK (kind IN ('earning', 'reversal', 'no_show_fee', 'payout')),
  amount_paise integer NOT NULL,
  available_at timestamptz NOT NULL,
  payout_run_id uuid REFERENCES app.payout_run (id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_by_provider ON app.ledger_entry (provider_account_id, created_at);
CREATE UNIQUE INDEX ledger_one_earning ON app.ledger_entry (booking_id, kind) WHERE kind IN ('earning', 'no_show_fee');
COMMENT ON COLUMN app.ledger_entry.id IS 'class=Internal';
COMMENT ON COLUMN app.ledger_entry.provider_account_id IS 'class=Internal';
COMMENT ON COLUMN app.ledger_entry.booking_id IS 'class=Internal';
COMMENT ON COLUMN app.ledger_entry.kind IS 'class=Internal';
COMMENT ON COLUMN app.ledger_entry.amount_paise IS 'class=Confidential';
COMMENT ON COLUMN app.ledger_entry.available_at IS 'class=Internal';
COMMENT ON COLUMN app.ledger_entry.payout_run_id IS 'class=Internal';
COMMENT ON COLUMN app.ledger_entry.created_at IS 'class=Internal';

-- Durable timers and background work (decision D-QUEUE). Payloads carry opaque IDs only.
CREATE TABLE app.job (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind ~ '^[a-z_]{2,40}$'),
  payload jsonb NOT NULL DEFAULT '{}',
  dedupe_key text UNIQUE CHECK (char_length(dedupe_key) BETWEEN 1 AND 120),
  run_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'dead')),
  attempts smallint NOT NULL DEFAULT 0,
  last_error text CHECK (char_length(last_error) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX job_due ON app.job (run_at) WHERE status = 'pending';
COMMENT ON COLUMN app.job.id IS 'class=Internal';
COMMENT ON COLUMN app.job.kind IS 'class=Internal';
COMMENT ON COLUMN app.job.payload IS 'class=Internal';
COMMENT ON COLUMN app.job.dedupe_key IS 'class=Internal';
COMMENT ON COLUMN app.job.run_at IS 'class=Internal';
COMMENT ON COLUMN app.job.status IS 'class=Internal';
COMMENT ON COLUMN app.job.attempts IS 'class=Internal';
COMMENT ON COLUMN app.job.last_error IS 'class=Internal';
COMMENT ON COLUMN app.job.created_at IS 'class=Internal';
COMMENT ON COLUMN app.job.finished_at IS 'class=Internal';

-- The in-app notification centre (NT-02): a template key and opaque params, never health detail.
CREATE TABLE app.notification (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES app.account (id) ON DELETE CASCADE,
  template text NOT NULL CHECK (template ~ '^[a-z_]{2,60}$'),
  params jsonb NOT NULL DEFAULT '{}',
  booking_id uuid REFERENCES app.booking (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX notification_by_account ON app.notification (account_id, created_at DESC);
COMMENT ON COLUMN app.notification.id IS 'class=Internal';
COMMENT ON COLUMN app.notification.account_id IS 'class=Internal';
COMMENT ON COLUMN app.notification.template IS 'class=Internal';
COMMENT ON COLUMN app.notification.params IS 'class=Internal';
COMMENT ON COLUMN app.notification.booking_id IS 'class=Internal';
COMMENT ON COLUMN app.notification.created_at IS 'class=Internal';
COMMENT ON COLUMN app.notification.read_at IS 'class=Internal';
