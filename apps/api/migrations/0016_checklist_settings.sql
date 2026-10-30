-- Up Migration
-- AD-08: operations staff decide which checklist documents are required for each provider type,
-- without a deployment. The items themselves (and their translated names) stay in code; police
-- verification stays required for everyone who visits a home (owner decision Q-POLICE).
CREATE TABLE app.checklist_setting (
  role text NOT NULL CHECK (role IN ('physiotherapist', 'nurse', 'attendant', 'lab', 'sample_collector')),
  item_key text NOT NULL CHECK (item_key ~ '^[a-z_]{2,60}$'),
  required boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, item_key)
);
COMMENT ON COLUMN app.checklist_setting.role IS 'class=Internal';
COMMENT ON COLUMN app.checklist_setting.item_key IS 'class=Internal';
COMMENT ON COLUMN app.checklist_setting.required IS 'class=Internal';
COMMENT ON COLUMN app.checklist_setting.updated_at IS 'class=Internal';
