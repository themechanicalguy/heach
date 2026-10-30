-- Up Migration
-- Completing Step 9: subscription renewals through a gateway mandate (PK-05), notification
-- templates and static pages that operations staff edit without a deployment (AD-09), and the
-- provider referral rewarded as a commission discount (RR-04).

INSERT INTO app.setting (key, value) VALUES
  ('renewal_notice_hours', 24),
  ('renewal_retry_hours', 24),
  ('renewal_max_attempts', 3),
  ('provider_referral_bookings', 5),
  ('provider_referral_rebate_percent', 50),
  ('provider_referral_rebate_bookings', 10);

-- PK-05: a subscription with auto-renew holds a mandate; each renewal is a new purchase linked
-- to the one it renews, so every period keeps its own entitlement ledger. Failed debits retry
-- and then pause renewal until the patient turns it on again.
ALTER TABLE app.plan_purchase
  ADD COLUMN mandate_id text CHECK (mandate_id ~ '^[A-Za-z0-9_-]{4,64}$'),
  ADD COLUMN renewed_from_id uuid UNIQUE REFERENCES app.plan_purchase (id),
  ADD COLUMN renewal_attempts integer NOT NULL DEFAULT 0 CHECK (renewal_attempts BETWEEN 0 AND 10),
  ADD COLUMN renewal_paused boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN app.plan_purchase.mandate_id IS 'class=Confidential';
COMMENT ON COLUMN app.plan_purchase.renewed_from_id IS 'class=Internal';
COMMENT ON COLUMN app.plan_purchase.renewal_attempts IS 'class=Internal';
COMMENT ON COLUMN app.plan_purchase.renewal_paused IS 'class=Internal';

-- AD-09: an edited text for a notification template in one language. The text keeps the
-- default's placeholders (checked by the API) and never holds personal data.
CREATE TABLE app.message_override (
  template text NOT NULL CHECK (template ~ '^[a-z_]{2,60}$'),
  locale text NOT NULL CHECK (locale IN ('or', 'en', 'hi')),
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 480),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template, locale)
);
COMMENT ON COLUMN app.message_override.template IS 'class=Public';
COMMENT ON COLUMN app.message_override.locale IS 'class=Public';
COMMENT ON COLUMN app.message_override.text IS 'class=Public';
COMMENT ON COLUMN app.message_override.updated_at IS 'class=Internal';

-- AD-09: static pages per language, shown as plain text (no markup is rendered).
CREATE TABLE app.content_page (
  slug text NOT NULL CHECK (slug IN ('terms', 'privacy', 'faq', 'refunds')),
  locale text NOT NULL CHECK (locale IN ('or', 'en', 'hi')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 50000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (slug, locale)
);
COMMENT ON COLUMN app.content_page.slug IS 'class=Public';
COMMENT ON COLUMN app.content_page.locale IS 'class=Public';
COMMENT ON COLUMN app.content_page.title IS 'class=Public';
COMMENT ON COLUMN app.content_page.body IS 'class=Public';
COMMENT ON COLUMN app.content_page.updated_at IS 'class=Internal';

-- RR-04: a referral between two providers; the referrer earns a share of the commission back on
-- a number of their later completed bookings once the invited provider is approved and has
-- completed enough bookings. Never paid for a patient's booking (RR-05).
ALTER TABLE app.referral ADD COLUMN kind text NOT NULL DEFAULT 'patient'
  CHECK (kind IN ('patient', 'provider'));
COMMENT ON COLUMN app.referral.kind IS 'class=Internal';

CREATE TABLE app.commission_credit (
  account_id uuid PRIMARY KEY REFERENCES app.account (id) ON DELETE CASCADE,
  bookings_left integer NOT NULL CHECK (bookings_left >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN app.commission_credit.account_id IS 'class=Internal';
COMMENT ON COLUMN app.commission_credit.bookings_left IS 'class=Internal';
COMMENT ON COLUMN app.commission_credit.updated_at IS 'class=Internal';

ALTER TABLE app.ledger_entry DROP CONSTRAINT ledger_entry_kind_check;
ALTER TABLE app.ledger_entry ADD CONSTRAINT ledger_entry_kind_check
  CHECK (kind IN ('earning', 'reversal', 'no_show_fee', 'payout', 'commission_rebate'));
CREATE UNIQUE INDEX ledger_one_rebate ON app.ledger_entry (booking_id) WHERE kind = 'commission_rebate';
