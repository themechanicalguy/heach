-- Up Migration
-- PY-05: one row per provider per payout run, written with the run, so that each gateway
-- transfer is sent at most once (its id is the transfer reference) and a failed one is retried.
CREATE TABLE app.payout_transfer (
  id uuid PRIMARY KEY,
  payout_run_id uuid NOT NULL REFERENCES app.payout_run (id),
  provider_account_id uuid NOT NULL REFERENCES app.account (id),
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent')),
  gateway_transfer_id text CHECK (char_length(gateway_transfer_id) BETWEEN 4 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (payout_run_id, provider_account_id),
  CHECK ((status = 'sent') = (gateway_transfer_id IS NOT NULL))
);
CREATE INDEX payout_transfer_pending ON app.payout_transfer (created_at) WHERE status = 'pending';
COMMENT ON COLUMN app.payout_transfer.id IS 'class=Internal';
COMMENT ON COLUMN app.payout_transfer.payout_run_id IS 'class=Internal';
COMMENT ON COLUMN app.payout_transfer.provider_account_id IS 'class=Internal';
COMMENT ON COLUMN app.payout_transfer.amount_paise IS 'class=Confidential';
COMMENT ON COLUMN app.payout_transfer.status IS 'class=Internal';
COMMENT ON COLUMN app.payout_transfer.gateway_transfer_id IS 'class=Internal';
COMMENT ON COLUMN app.payout_transfer.created_at IS 'class=Internal';
COMMENT ON COLUMN app.payout_transfer.sent_at IS 'class=Internal';
