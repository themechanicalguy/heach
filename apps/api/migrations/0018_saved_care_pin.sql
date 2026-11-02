-- SD-04: an optional remembered search location per care recipient, not a booking address.
CREATE TABLE app.care_pin (
  account_id uuid NOT NULL REFERENCES app.account(id) ON DELETE CASCADE,
  linked_patient_id uuid REFERENCES app.linked_patient(id) ON DELETE CASCADE,
  pin text NOT NULL CHECK (pin ~ '^[1-9][0-9]{5}$'),
  UNIQUE NULLS NOT DISTINCT (account_id, linked_patient_id)
);
COMMENT ON COLUMN app.care_pin.account_id IS 'class=Confidential';
COMMENT ON COLUMN app.care_pin.linked_patient_id IS 'class=Confidential';
COMMENT ON COLUMN app.care_pin.pin IS 'class=Confidential';
