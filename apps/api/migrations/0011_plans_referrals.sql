-- Up Migration
-- Plans, referrals and admin completion (Step 9, J8): care packages and subscriptions with their
-- terms in three languages (PK-01 to PK-03), purchases paid through the gateway, the entitlement
-- ledger drawn at checkout (PK-04, BK-08), coupons (RR-03, RR-08) and referrals with abuse
-- controls (RR-01 to RR-07).

INSERT INTO app.setting (key, value) VALUES
  ('referral_reward_paise', 10000),
  ('referral_invitee_reward_paise', 5000),
  ('coupon_validity_days', 90),
  ('referral_monthly_cap', 10),
  ('referral_join_window_days', 7),
  ('plan_expiry_reminder_days', 7);

CREATE TABLE app.plan (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('package', 'subscription')),
  -- A package can be a provider's own (approved by an admin, PK-01); subscriptions are admin plans.
  provider_account_id uuid REFERENCES app.account (id) ON DELETE CASCADE,
  item_id uuid REFERENCES app.catalogue_item (id),
  service text CHECK (service IN ('physiotherapy', 'nursing', 'attendant', 'lab')),
  units integer NOT NULL CHECK (units BETWEEN 1 AND 365),
  discount_percent integer NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 50),
  period text CHECK (period IN ('monthly', 'quarterly', 'yearly')),
  family_members integer NOT NULL DEFAULT 0 CHECK (family_members BETWEEN 0 AND 6),
  validity_days integer NOT NULL CHECK (validity_days BETWEEN 7 AND 400),
  price_paise integer NOT NULL CHECK (price_paise >= 100),
  status text NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'active', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'package') = (item_id IS NOT NULL)),
  CHECK ((kind = 'subscription') = (period IS NOT NULL AND service IS NOT NULL)),
  CHECK (kind = 'package' OR provider_account_id IS NULL)
);
COMMENT ON COLUMN app.plan.id IS 'class=Public';
COMMENT ON COLUMN app.plan.kind IS 'class=Public';
COMMENT ON COLUMN app.plan.provider_account_id IS 'class=Public';
COMMENT ON COLUMN app.plan.item_id IS 'class=Public';
COMMENT ON COLUMN app.plan.service IS 'class=Public';
COMMENT ON COLUMN app.plan.units IS 'class=Public';
COMMENT ON COLUMN app.plan.discount_percent IS 'class=Public';
COMMENT ON COLUMN app.plan.period IS 'class=Public';
COMMENT ON COLUMN app.plan.family_members IS 'class=Public';
COMMENT ON COLUMN app.plan.validity_days IS 'class=Public';
COMMENT ON COLUMN app.plan.price_paise IS 'class=Public';
COMMENT ON COLUMN app.plan.status IS 'class=Public';
COMMENT ON COLUMN app.plan.created_at IS 'class=Internal';

-- The plan's terms in each language, shown before purchase (PK-03).
CREATE TABLE app.plan_text (
  plan_id uuid NOT NULL REFERENCES app.plan (id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('or', 'en', 'hi')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  inclusions text NOT NULL CHECK (char_length(inclusions) BETWEEN 1 AND 600),
  exclusions text NOT NULL CHECK (char_length(exclusions) BETWEEN 1 AND 600),
  PRIMARY KEY (plan_id, locale)
);
COMMENT ON COLUMN app.plan_text.plan_id IS 'class=Public';
COMMENT ON COLUMN app.plan_text.locale IS 'class=Public';
COMMENT ON COLUMN app.plan_text.name IS 'class=Public';
COMMENT ON COLUMN app.plan_text.inclusions IS 'class=Public';
COMMENT ON COLUMN app.plan_text.exclusions IS 'class=Public';

CREATE TABLE app.plan_purchase (
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES app.plan (id),
  buyer_account_id uuid NOT NULL REFERENCES app.account (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'active', 'expired', 'cancelled')),
  auto_renew boolean NOT NULL DEFAULT false,
  price_paise integer NOT NULL CHECK (price_paise >= 0),
  paid_paise integer NOT NULL DEFAULT 0 CHECK (paid_paise >= 0),
  refunded_paise integer NOT NULL DEFAULT 0 CHECK (refunded_paise >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (refunded_paise <= paid_paise)
);
CREATE INDEX plan_purchase_by_buyer ON app.plan_purchase (buyer_account_id, created_at DESC);
COMMENT ON COLUMN app.plan_purchase.id IS 'class=Internal';
COMMENT ON COLUMN app.plan_purchase.plan_id IS 'class=Internal';
COMMENT ON COLUMN app.plan_purchase.buyer_account_id IS 'class=Internal';
COMMENT ON COLUMN app.plan_purchase.status IS 'class=Internal';
COMMENT ON COLUMN app.plan_purchase.auto_renew IS 'class=Internal';
COMMENT ON COLUMN app.plan_purchase.price_paise IS 'class=Confidential';
COMMENT ON COLUMN app.plan_purchase.paid_paise IS 'class=Confidential';
COMMENT ON COLUMN app.plan_purchase.refunded_paise IS 'class=Confidential';
COMMENT ON COLUMN app.plan_purchase.starts_at IS 'class=Internal';
COMMENT ON COLUMN app.plan_purchase.ends_at IS 'class=Internal';
COMMENT ON COLUMN app.plan_purchase.created_at IS 'class=Internal';

-- A purchase is paid like a booking: a payment belongs to exactly one of them.
ALTER TABLE app.payment ALTER COLUMN booking_id DROP NOT NULL;
ALTER TABLE app.payment ADD COLUMN purchase_id uuid REFERENCES app.plan_purchase (id);
ALTER TABLE app.payment DROP CONSTRAINT payment_purpose_check;
ALTER TABLE app.payment ADD CONSTRAINT payment_purpose_check CHECK (purpose IN ('booking', 'balance', 'plan'));
ALTER TABLE app.payment ADD CONSTRAINT payment_one_owner CHECK ((booking_id IS NULL) <> (purchase_id IS NULL));
COMMENT ON COLUMN app.payment.purchase_id IS 'class=Internal';
ALTER TABLE app.refund ALTER COLUMN booking_id DROP NOT NULL;
ALTER TABLE app.refund ADD COLUMN purchase_id uuid REFERENCES app.plan_purchase (id);
COMMENT ON COLUMN app.refund.purchase_id IS 'class=Internal';

-- The entitlement ledger (PK-04): what a purchase gives and what is used, booking by booking.
CREATE TABLE app.entitlement (
  id uuid PRIMARY KEY,
  purchase_id uuid NOT NULL REFERENCES app.plan_purchase (id) ON DELETE CASCADE,
  item_id uuid REFERENCES app.catalogue_item (id),
  service text CHECK (service IN ('physiotherapy', 'nursing', 'attendant', 'lab')),
  provider_account_id uuid REFERENCES app.account (id),
  units_total integer NOT NULL CHECK (units_total >= 1),
  units_used integer NOT NULL DEFAULT 0,
  discount_percent integer NOT NULL DEFAULT 0,
  CHECK (units_used BETWEEN 0 AND units_total),
  CHECK (item_id IS NOT NULL OR service IS NOT NULL)
);
CREATE INDEX entitlement_by_purchase ON app.entitlement (purchase_id);
COMMENT ON COLUMN app.entitlement.id IS 'class=Internal';
COMMENT ON COLUMN app.entitlement.purchase_id IS 'class=Internal';
COMMENT ON COLUMN app.entitlement.item_id IS 'class=Internal';
COMMENT ON COLUMN app.entitlement.service IS 'class=Internal';
COMMENT ON COLUMN app.entitlement.provider_account_id IS 'class=Internal';
COMMENT ON COLUMN app.entitlement.units_total IS 'class=Internal';
COMMENT ON COLUMN app.entitlement.units_used IS 'class=Internal';
COMMENT ON COLUMN app.entitlement.discount_percent IS 'class=Internal';

CREATE TABLE app.entitlement_use (
  id uuid PRIMARY KEY,
  entitlement_id uuid NOT NULL REFERENCES app.entitlement (id) ON DELETE CASCADE,
  booking_id uuid NOT NULL UNIQUE REFERENCES app.booking (id) ON DELETE CASCADE,
  units integer NOT NULL CHECK (units >= 1),
  value_paise integer NOT NULL CHECK (value_paise >= 0),
  reversed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN app.entitlement_use.id IS 'class=Internal';
COMMENT ON COLUMN app.entitlement_use.entitlement_id IS 'class=Internal';
COMMENT ON COLUMN app.entitlement_use.booking_id IS 'class=Internal';
COMMENT ON COLUMN app.entitlement_use.units IS 'class=Internal';
COMMENT ON COLUMN app.entitlement_use.value_paise IS 'class=Confidential';
COMMENT ON COLUMN app.entitlement_use.reversed_at IS 'class=Internal';
COMMENT ON COLUMN app.entitlement_use.created_at IS 'class=Internal';

ALTER TABLE app.booking ADD COLUMN coupon_id uuid;
COMMENT ON COLUMN app.booking.coupon_id IS 'class=Internal';

-- Discount coupons (RR-03): a value, an expiry, one booking, never cash.
CREATE TABLE app.coupon (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES app.account (id) ON DELETE CASCADE,
  value_paise integer NOT NULL CHECK (value_paise BETWEEN 100 AND 100000),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'cancelled')),
  used_booking_id uuid REFERENCES app.booking (id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('referral', 'referral_welcome')),
  referral_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'used') = (used_booking_id IS NOT NULL))
);
CREATE INDEX coupon_by_account ON app.coupon (account_id, status);
COMMENT ON COLUMN app.coupon.id IS 'class=Internal';
COMMENT ON COLUMN app.coupon.account_id IS 'class=Internal';
COMMENT ON COLUMN app.coupon.value_paise IS 'class=Internal';
COMMENT ON COLUMN app.coupon.expires_at IS 'class=Internal';
COMMENT ON COLUMN app.coupon.status IS 'class=Internal';
COMMENT ON COLUMN app.coupon.used_booking_id IS 'class=Internal';
COMMENT ON COLUMN app.coupon.source IS 'class=Internal';
COMMENT ON COLUMN app.coupon.referral_id IS 'class=Internal';
COMMENT ON COLUMN app.coupon.created_at IS 'class=Internal';

CREATE TABLE app.referral_code (
  account_id uuid PRIMARY KEY REFERENCES app.account (id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{8}$')
);
COMMENT ON COLUMN app.referral_code.account_id IS 'class=Internal';
COMMENT ON COLUMN app.referral_code.code IS 'class=Internal';

-- One referral per invited account (RR-06): joined, rewarded after the qualifying event, or held.
CREATE TABLE app.referral (
  id uuid PRIMARY KEY,
  referrer_account_id uuid NOT NULL REFERENCES app.account (id) ON DELETE CASCADE,
  invitee_account_id uuid NOT NULL UNIQUE REFERENCES app.account (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'rewarded', 'flagged', 'rejected')),
  flag_reason text CHECK (flag_reason ~ '^[a-z_]{1,40}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  rewarded_at timestamptz,
  CHECK (referrer_account_id <> invitee_account_id)
);
CREATE INDEX referral_by_referrer ON app.referral (referrer_account_id, created_at DESC);
COMMENT ON COLUMN app.referral.id IS 'class=Internal';
COMMENT ON COLUMN app.referral.referrer_account_id IS 'class=Internal';
COMMENT ON COLUMN app.referral.invitee_account_id IS 'class=Internal';
COMMENT ON COLUMN app.referral.status IS 'class=Internal';
COMMENT ON COLUMN app.referral.flag_reason IS 'class=Internal';
COMMENT ON COLUMN app.referral.created_at IS 'class=Internal';
COMMENT ON COLUMN app.referral.rewarded_at IS 'class=Internal';
