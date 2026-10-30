-- Up Migration
-- RR-06: one referral reward per device. A referral records the keyed hash of a referral-only
-- device ID (never the ID itself); a second invitee joining from the same device is held for
-- review (owner decision on 30 October 2026).
ALTER TABLE app.referral ADD COLUMN device_hash text CHECK (device_hash ~ '^[0-9a-f]{64}$');
COMMENT ON COLUMN app.referral.device_hash IS 'class=Confidential';
CREATE INDEX referral_by_device ON app.referral (device_hash) WHERE device_hash IS NOT NULL;
