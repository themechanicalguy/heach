-- Up Migration
-- Lab tests (Step 7, J7): a lab order is a booking of kind lab_test with one or more tests from
-- one lab (LB-03), home collection or walk-in (LB-02), the assigned collector (LB-05), the
-- booking-linked sample identifier (LB-06), status events (LB-07), and encrypted reports with
-- corrections and re-collections (LB-08, LB-10).

CREATE TABLE app.lab_order (
  booking_id uuid PRIMARY KEY REFERENCES app.booking (id) ON DELETE CASCADE,
  collection text NOT NULL CHECK (collection IN ('home', 'walk_in')),
  stage text NOT NULL DEFAULT 'booked' CHECK (stage IN (
    'booked', 'collector_assigned', 'sample_collected', 'received', 'report_ready'
  )),
  collector_account_id uuid REFERENCES app.account (id),
  sample_id text UNIQUE CHECK (sample_id ~ '^HX-[0-9A-Z]{10}$'),
  collected_at timestamptz,
  report_hours integer NOT NULL CHECK (report_hours BETWEEN 1 AND 720),
  recollections smallint NOT NULL DEFAULT 0,
  CHECK ((stage IN ('sample_collected', 'received', 'report_ready')) = (sample_id IS NOT NULL))
);
COMMENT ON COLUMN app.lab_order.booking_id IS 'class=Internal';
COMMENT ON COLUMN app.lab_order.collection IS 'class=Internal';
COMMENT ON COLUMN app.lab_order.stage IS 'class=Internal';
COMMENT ON COLUMN app.lab_order.collector_account_id IS 'class=Internal';
COMMENT ON COLUMN app.lab_order.sample_id IS 'class=Confidential';
COMMENT ON COLUMN app.lab_order.collected_at IS 'class=Confidential';
COMMENT ON COLUMN app.lab_order.report_hours IS 'class=Internal';
COMMENT ON COLUMN app.lab_order.recollections IS 'class=Internal';

-- The tests in one order, with each price frozen at checkout.
CREATE TABLE app.lab_order_item (
  booking_id uuid NOT NULL REFERENCES app.booking (id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES app.catalogue_item (id),
  listing_id uuid NOT NULL REFERENCES app.listing (id),
  fee_paise integer NOT NULL CHECK (fee_paise >= 0),
  PRIMARY KEY (booking_id, item_id)
);
COMMENT ON COLUMN app.lab_order_item.booking_id IS 'class=Internal';
COMMENT ON COLUMN app.lab_order_item.item_id IS 'class=Confidential';
COMMENT ON COLUMN app.lab_order_item.listing_id IS 'class=Internal';
COMMENT ON COLUMN app.lab_order_item.fee_paise IS 'class=Confidential';

CREATE TABLE app.lab_event (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES app.booking (id) ON DELETE CASCADE,
  stage text NOT NULL,
  reason text CHECK (reason ~ '^[a-z_]{1,40}$'),
  actor_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lab_event_by_booking ON app.lab_event (booking_id, created_at);
COMMENT ON COLUMN app.lab_event.id IS 'class=Internal';
COMMENT ON COLUMN app.lab_event.booking_id IS 'class=Internal';
COMMENT ON COLUMN app.lab_event.stage IS 'class=Internal';
COMMENT ON COLUMN app.lab_event.reason IS 'class=Internal';
COMMENT ON COLUMN app.lab_event.actor_role IS 'class=Internal';
COMMENT ON COLUMN app.lab_event.created_at IS 'class=Internal';

-- Each report version; a correction adds a version with its reason (LB-08, LB-10).
CREATE TABLE app.lab_report (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES app.booking (id) ON DELETE CASCADE,
  object_id uuid NOT NULL REFERENCES app.stored_object (id),
  version smallint NOT NULL CHECK (version >= 1),
  correction_reason text CHECK (correction_reason ~ '^[a-z_]{1,40}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, version),
  CHECK ((version = 1) = (correction_reason IS NULL))
);
COMMENT ON COLUMN app.lab_report.id IS 'class=Internal';
COMMENT ON COLUMN app.lab_report.booking_id IS 'class=Internal';
COMMENT ON COLUMN app.lab_report.object_id IS 'class=Internal';
COMMENT ON COLUMN app.lab_report.version IS 'class=Internal';
COMMENT ON COLUMN app.lab_report.correction_reason IS 'class=Internal';
COMMENT ON COLUMN app.lab_report.created_at IS 'class=Internal';
