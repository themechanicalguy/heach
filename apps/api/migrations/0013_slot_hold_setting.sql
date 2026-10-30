-- Up Migration
-- AD-08: how long a slot stays held during checkout becomes an operations setting, so the slot
-- lock time changes without a deployment. The default keeps today's ten minutes.
INSERT INTO app.setting (key, value) VALUES ('slot_hold_minutes', 10);
