-- Up Migration
-- Listings, availability and search (Step 4): the service catalogue for the four MVP services in
-- three languages (AD-04, I18N-05, SL-06, SL-09), provider listings (SL-02 to SL-04, SL-07), PIN
-- code service areas (SL-05, SD-04), weekly availability with leave and buffers (AV-01, AV-03).
-- Catalogue, listing and area data are Public: they appear on indexable pages (SD-05).

CREATE TABLE app.catalogue_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_]{2,60}$'),
  service text NOT NULL CHECK (service IN ('physiotherapy', 'nursing', 'attendant', 'lab')),
  kind text NOT NULL CHECK (kind IN ('visit', 'shift', 'lab_test')),
  -- Attendants are non-clinical and may never list a clinical item (regulatory point).
  clinical boolean NOT NULL,
  prescription_required boolean NOT NULL DEFAULT false,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 10 AND 1440),
  sample_type text CHECK (sample_type IN ('blood', 'urine', 'stool', 'swab')),
  report_hours integer CHECK (report_hours BETWEEN 1 AND 720),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  CHECK ((kind = 'lab_test') = (sample_type IS NOT NULL)),
  CHECK (service <> 'attendant' OR NOT clinical)
);

COMMENT ON COLUMN app.catalogue_item.id IS 'class=Public';
COMMENT ON COLUMN app.catalogue_item.code IS 'class=Public';
COMMENT ON COLUMN app.catalogue_item.service IS 'class=Public';
COMMENT ON COLUMN app.catalogue_item.kind IS 'class=Public';
COMMENT ON COLUMN app.catalogue_item.clinical IS 'class=Public';
COMMENT ON COLUMN app.catalogue_item.prescription_required IS 'class=Public';
COMMENT ON COLUMN app.catalogue_item.duration_minutes IS 'class=Public';
COMMENT ON COLUMN app.catalogue_item.sample_type IS 'class=Public';
COMMENT ON COLUMN app.catalogue_item.report_hours IS 'class=Public';
COMMENT ON COLUMN app.catalogue_item.active IS 'class=Public';
COMMENT ON COLUMN app.catalogue_item.sort_order IS 'class=Public';

CREATE TABLE app.catalogue_item_text (
  item_id uuid NOT NULL REFERENCES app.catalogue_item (id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('or', 'en', 'hi')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  preparation text CHECK (char_length(preparation) BETWEEN 1 AND 400),
  -- Lower-cased name for spelling-tolerant search (SD-02, decision D-SEARCH).
  search_name text GENERATED ALWAYS AS (lower(name)) STORED,
  PRIMARY KEY (item_id, locale)
);
COMMENT ON COLUMN app.catalogue_item_text.item_id IS 'class=Public';
COMMENT ON COLUMN app.catalogue_item_text.locale IS 'class=Public';
COMMENT ON COLUMN app.catalogue_item_text.name IS 'class=Public';
COMMENT ON COLUMN app.catalogue_item_text.preparation IS 'class=Public';
COMMENT ON COLUMN app.catalogue_item_text.search_name IS 'class=Public';

INSERT INTO app.catalogue_item (code, service, kind, clinical, prescription_required, duration_minutes, sample_type, report_hours, sort_order) VALUES ('physio_assessment', 'physiotherapy', 'visit', true, false, 60, NULL, NULL, 0);
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'en', 'Physiotherapy assessment', NULL FROM app.catalogue_item WHERE code = 'physio_assessment';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'or', 'ଫିଜିଓଥେରାପି ମୂଲ୍ୟାଙ୍କନ', NULL FROM app.catalogue_item WHERE code = 'physio_assessment';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'hi', 'फिजियोथेरेपी आकलन', NULL FROM app.catalogue_item WHERE code = 'physio_assessment';
INSERT INTO app.catalogue_item (code, service, kind, clinical, prescription_required, duration_minutes, sample_type, report_hours, sort_order) VALUES ('physio_ortho_rehab', 'physiotherapy', 'visit', true, false, 45, NULL, NULL, 1);
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'en', 'Orthopaedic rehabilitation session', NULL FROM app.catalogue_item WHERE code = 'physio_ortho_rehab';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'or', 'ଅସ୍ଥି ପୁନର୍ବାସ ସେସନ୍', NULL FROM app.catalogue_item WHERE code = 'physio_ortho_rehab';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'hi', 'हड्डी पुनर्वास सत्र', NULL FROM app.catalogue_item WHERE code = 'physio_ortho_rehab';
INSERT INTO app.catalogue_item (code, service, kind, clinical, prescription_required, duration_minutes, sample_type, report_hours, sort_order) VALUES ('physio_neuro_rehab', 'physiotherapy', 'visit', true, false, 45, NULL, NULL, 2);
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'en', 'Neuro rehabilitation session', NULL FROM app.catalogue_item WHERE code = 'physio_neuro_rehab';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'or', 'ସ୍ନାୟୁ ପୁନର୍ବାସ ସେସନ୍', NULL FROM app.catalogue_item WHERE code = 'physio_neuro_rehab';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'hi', 'न्यूरो पुनर्वास सत्र', NULL FROM app.catalogue_item WHERE code = 'physio_neuro_rehab';
INSERT INTO app.catalogue_item (code, service, kind, clinical, prescription_required, duration_minutes, sample_type, report_hours, sort_order) VALUES ('physio_post_operative', 'physiotherapy', 'visit', true, false, 45, NULL, NULL, 3);
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'en', 'Post-operative physiotherapy', NULL FROM app.catalogue_item WHERE code = 'physio_post_operative';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'or', 'ଅସ୍ତ୍ରୋପଚାର ପରବର୍ତ୍ତୀ ଫିଜିଓଥେରାପି', NULL FROM app.catalogue_item WHERE code = 'physio_post_operative';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'hi', 'ऑपरेशन के बाद फिजियोथेरेपी', NULL FROM app.catalogue_item WHERE code = 'physio_post_operative';
INSERT INTO app.catalogue_item (code, service, kind, clinical, prescription_required, duration_minutes, sample_type, report_hours, sort_order) VALUES ('physio_geriatric', 'physiotherapy', 'visit', true, false, 45, NULL, NULL, 4);
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'en', 'Geriatric physiotherapy', NULL FROM app.catalogue_item WHERE code = 'physio_geriatric';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'or', 'ବୟସ୍କଙ୍କ ପାଇଁ ଫିଜିଓଥେରାପି', NULL FROM app.catalogue_item WHERE code = 'physio_geriatric';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'hi', 'बुज़ुर्गों के लिए फिजियोथेरेपी', NULL FROM app.catalogue_item WHERE code = 'physio_geriatric';
INSERT INTO app.catalogue_item (code, service, kind, clinical, prescription_required, duration_minutes, sample_type, report_hours, sort_order) VALUES ('nursing_injection', 'nursing', 'visit', true, true, 30, NULL, NULL, 5);
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'en', 'Injection (IM, IV or SC)', NULL FROM app.catalogue_item WHERE code = 'nursing_injection';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'or', 'ଇଞ୍ଜେକ୍ସନ୍ (IM, IV କିମ୍ବା SC)', NULL FROM app.catalogue_item WHERE code = 'nursing_injection';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'hi', 'इंजेक्शन (IM, IV या SC)', NULL FROM app.catalogue_item WHERE code = 'nursing_injection';
INSERT INTO app.catalogue_item (code, service, kind, clinical, prescription_required, duration_minutes, sample_type, report_hours, sort_order) VALUES ('nursing_wound_dressing', 'nursing', 'visit', true, false, 45, NULL, NULL, 6);
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'en', 'Wound cleaning and dressing', NULL FROM app.catalogue_item WHERE code = 'nursing_wound_dressing';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'or', 'ଘାଆ ସଫା ଓ ଡ୍ରେସିଂ', NULL FROM app.catalogue_item WHERE code = 'nursing_wound_dressing';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'hi', 'घाव की सफ़ाई और ड्रेसिंग', NULL FROM app.catalogue_item WHERE code = 'nursing_wound_dressing';
INSERT INTO app.catalogue_item (code, service, kind, clinical, prescription_required, duration_minutes, sample_type, report_hours, sort_order) VALUES ('nursing_catheter_care', 'nursing', 'visit', true, true, 45, NULL, NULL, 7);
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'en', 'Catheter care', NULL FROM app.catalogue_item WHERE code = 'nursing_catheter_care';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'or', 'କ୍ୟାଥେଟର ଯତ୍ନ', NULL FROM app.catalogue_item WHERE code = 'nursing_catheter_care';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'hi', 'कैथेटर देखभाल', NULL FROM app.catalogue_item WHERE code = 'nursing_catheter_care';
INSERT INTO app.catalogue_item (code, service, kind, clinical, prescription_required, duration_minutes, sample_type, report_hours, sort_order) VALUES ('nursing_vitals_check', 'nursing', 'visit', true, false, 30, NULL, NULL, 8);
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'en', 'Vitals check', NULL FROM app.catalogue_item WHERE code = 'nursing_vitals_check';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'or', 'ଜୀବନ ଚିହ୍ନ ଯାଞ୍ଚ', NULL FROM app.catalogue_item WHERE code = 'nursing_vitals_check';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'hi', 'वाइटल्स जाँच', NULL FROM app.catalogue_item WHERE code = 'nursing_vitals_check';
INSERT INTO app.catalogue_item (code, service, kind, clinical, prescription_required, duration_minutes, sample_type, report_hours, sort_order) VALUES ('nursing_iv_fluids', 'nursing', 'visit', true, true, 90, NULL, NULL, 9);
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'en', 'IV fluids', NULL FROM app.catalogue_item WHERE code = 'nursing_iv_fluids';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'or', 'IV ତରଳ', NULL FROM app.catalogue_item WHERE code = 'nursing_iv_fluids';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'hi', 'IV फ्लूइड', NULL FROM app.catalogue_item WHERE code = 'nursing_iv_fluids';
INSERT INTO app.catalogue_item (code, service, kind, clinical, prescription_required, duration_minutes, sample_type, report_hours, sort_order) VALUES ('attendant_day_12h', 'attendant', 'shift', false, false, 720, NULL, NULL, 10);
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'en', 'Attendant, 12-hour day shift', NULL FROM app.catalogue_item WHERE code = 'attendant_day_12h';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'or', 'ସେବକ, ୧୨ ଘଣ୍ଟା ଦିନ ପାଳି', NULL FROM app.catalogue_item WHERE code = 'attendant_day_12h';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'hi', 'अटेंडेंट, 12 घंटे दिन की शिफ्ट', NULL FROM app.catalogue_item WHERE code = 'attendant_day_12h';
INSERT INTO app.catalogue_item (code, service, kind, clinical, prescription_required, duration_minutes, sample_type, report_hours, sort_order) VALUES ('attendant_night_12h', 'attendant', 'shift', false, false, 720, NULL, NULL, 11);
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'en', 'Attendant, 12-hour night shift', NULL FROM app.catalogue_item WHERE code = 'attendant_night_12h';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'or', 'ସେବକ, ୧୨ ଘଣ୍ଟା ରାତି ପାଳି', NULL FROM app.catalogue_item WHERE code = 'attendant_night_12h';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'hi', 'अटेंडेंट, 12 घंटे रात की शिफ्ट', NULL FROM app.catalogue_item WHERE code = 'attendant_night_12h';
INSERT INTO app.catalogue_item (code, service, kind, clinical, prescription_required, duration_minutes, sample_type, report_hours, sort_order) VALUES ('attendant_24h', 'attendant', 'shift', false, false, 1440, NULL, NULL, 12);
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'en', 'Attendant, 24-hour care', NULL FROM app.catalogue_item WHERE code = 'attendant_24h';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'or', 'ସେବକ, ୨୪ ଘଣ୍ଟା ଯତ୍ନ', NULL FROM app.catalogue_item WHERE code = 'attendant_24h';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'hi', 'अटेंडेंट, 24 घंटे देखभाल', NULL FROM app.catalogue_item WHERE code = 'attendant_24h';
INSERT INTO app.catalogue_item (code, service, kind, clinical, prescription_required, duration_minutes, sample_type, report_hours, sort_order) VALUES ('lab_cbc', 'lab', 'lab_test', true, false, 15, 'blood', '24', 13);
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'en', 'Complete blood count (CBC)', 'No special preparation.' FROM app.catalogue_item WHERE code = 'lab_cbc';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'or', 'ସମ୍ପୂର୍ଣ୍ଣ ରକ୍ତ ଗଣନା (CBC)', 'କୌଣସି ବିଶେଷ ପ୍ରସ୍ତୁତି ଆବଶ୍ୟକ ନାହିଁ।' FROM app.catalogue_item WHERE code = 'lab_cbc';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'hi', 'संपूर्ण रक्त गणना (CBC)', 'कोई विशेष तैयारी नहीं।' FROM app.catalogue_item WHERE code = 'lab_cbc';
INSERT INTO app.catalogue_item (code, service, kind, clinical, prescription_required, duration_minutes, sample_type, report_hours, sort_order) VALUES ('lab_blood_sugar_fasting', 'lab', 'lab_test', true, false, 15, 'blood', '12', 14);
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'en', 'Blood sugar, fasting', 'Fast for 10 to 12 hours before the sample. Water is allowed.' FROM app.catalogue_item WHERE code = 'lab_blood_sugar_fasting';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'or', 'ରକ୍ତ ଶର୍କରା, ଖାଲି ପେଟ', 'ନମୁନା ପୂର୍ବରୁ ୧୦ ରୁ ୧୨ ଘଣ୍ଟା ଖାଲି ପେଟରେ ରୁହନ୍ତୁ। ପାଣି ପିଇପାରିବେ।' FROM app.catalogue_item WHERE code = 'lab_blood_sugar_fasting';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'hi', 'ब्लड शुगर, खाली पेट', 'सैंपल से पहले 10 से 12 घंटे कुछ न खाएँ। पानी पी सकते हैं।' FROM app.catalogue_item WHERE code = 'lab_blood_sugar_fasting';
INSERT INTO app.catalogue_item (code, service, kind, clinical, prescription_required, duration_minutes, sample_type, report_hours, sort_order) VALUES ('lab_hba1c', 'lab', 'lab_test', true, false, 15, 'blood', '24', 15);
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'en', 'HbA1c', 'No special preparation.' FROM app.catalogue_item WHERE code = 'lab_hba1c';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'or', 'HbA1c', 'କୌଣସି ବିଶେଷ ପ୍ରସ୍ତୁତି ଆବଶ୍ୟକ ନାହିଁ।' FROM app.catalogue_item WHERE code = 'lab_hba1c';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'hi', 'HbA1c', 'कोई विशेष तैयारी नहीं।' FROM app.catalogue_item WHERE code = 'lab_hba1c';
INSERT INTO app.catalogue_item (code, service, kind, clinical, prescription_required, duration_minutes, sample_type, report_hours, sort_order) VALUES ('lab_lipid_profile', 'lab', 'lab_test', true, false, 15, 'blood', '24', 16);
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'en', 'Lipid profile', 'Fast for 10 to 12 hours before the sample. Water is allowed.' FROM app.catalogue_item WHERE code = 'lab_lipid_profile';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'or', 'ଲିପିଡ୍ ପ୍ରୋଫାଇଲ୍', 'ନମୁନା ପୂର୍ବରୁ ୧୦ ରୁ ୧୨ ଘଣ୍ଟା ଖାଲି ପେଟରେ ରୁହନ୍ତୁ। ପାଣି ପିଇପାରିବେ।' FROM app.catalogue_item WHERE code = 'lab_lipid_profile';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'hi', 'लिपिड प्रोफ़ाइल', 'सैंपल से पहले 10 से 12 घंटे कुछ न खाएँ। पानी पी सकते हैं।' FROM app.catalogue_item WHERE code = 'lab_lipid_profile';
INSERT INTO app.catalogue_item (code, service, kind, clinical, prescription_required, duration_minutes, sample_type, report_hours, sort_order) VALUES ('lab_thyroid_profile', 'lab', 'lab_test', true, false, 15, 'blood', '48', 17);
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'en', 'Thyroid profile (T3, T4, TSH)', 'No special preparation.' FROM app.catalogue_item WHERE code = 'lab_thyroid_profile';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'or', 'ଥାଇରଏଡ୍ ପ୍ରୋଫାଇଲ୍ (T3, T4, TSH)', 'କୌଣସି ବିଶେଷ ପ୍ରସ୍ତୁତି ଆବଶ୍ୟକ ନାହିଁ।' FROM app.catalogue_item WHERE code = 'lab_thyroid_profile';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'hi', 'थायरॉइड प्रोफ़ाइल (T3, T4, TSH)', 'कोई विशेष तैयारी नहीं।' FROM app.catalogue_item WHERE code = 'lab_thyroid_profile';
INSERT INTO app.catalogue_item (code, service, kind, clinical, prescription_required, duration_minutes, sample_type, report_hours, sort_order) VALUES ('lab_urine_routine', 'lab', 'lab_test', true, false, 15, 'urine', '24', 18);
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'en', 'Urine routine', 'No special preparation.' FROM app.catalogue_item WHERE code = 'lab_urine_routine';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'or', 'ପରିସ୍ରା ସାଧାରଣ ପରୀକ୍ଷା', 'କୌଣସି ବିଶେଷ ପ୍ରସ୍ତୁତି ଆବଶ୍ୟକ ନାହିଁ।' FROM app.catalogue_item WHERE code = 'lab_urine_routine';
INSERT INTO app.catalogue_item_text (item_id, locale, name, preparation) SELECT id, 'hi', 'मूत्र सामान्य जाँच', 'कोई विशेष तैयारी नहीं।' FROM app.catalogue_item WHERE code = 'lab_urine_routine';

-- Serviceable PIN codes (AD-08). Pilot districts only until the full dataset (decision D-PIN).
CREATE TABLE app.pin_code (
  pin text PRIMARY KEY CHECK (pin ~ '^[1-9][0-9]{5}$'),
  district text NOT NULL CHECK (char_length(district) BETWEEN 1 AND 60),
  serviceable boolean NOT NULL DEFAULT true
);
COMMENT ON COLUMN app.pin_code.pin IS 'class=Public';
COMMENT ON COLUMN app.pin_code.district IS 'class=Public';
COMMENT ON COLUMN app.pin_code.serviceable IS 'class=Public';
INSERT INTO app.pin_code (pin, district) VALUES
  ('751001', 'Khordha'),
  ('751002', 'Khordha'),
  ('751003', 'Khordha'),
  ('751006', 'Khordha'),
  ('751007', 'Khordha'),
  ('751009', 'Khordha'),
  ('751010', 'Khordha'),
  ('751012', 'Khordha'),
  ('751013', 'Khordha'),
  ('751014', 'Khordha'),
  ('751015', 'Khordha'),
  ('751016', 'Khordha'),
  ('751017', 'Khordha'),
  ('751019', 'Khordha'),
  ('751020', 'Khordha'),
  ('751024', 'Khordha'),
  ('751030', 'Khordha'),
  ('753001', 'Cuttack'),
  ('753002', 'Cuttack'),
  ('753003', 'Cuttack'),
  ('753004', 'Cuttack'),
  ('753007', 'Cuttack'),
  ('753008', 'Cuttack'),
  ('753012', 'Cuttack'),
  ('753014', 'Cuttack');

-- A provider's offer of one catalogue item (SL-02 to SL-04, SL-09); fees in paise.
CREATE TABLE app.listing (
  id uuid PRIMARY KEY,
  provider_account_id uuid NOT NULL REFERENCES app.account (id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES app.catalogue_item (id),
  fee_paise integer NOT NULL CHECK (fee_paise BETWEEN 100 AND 10000000),
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 10 AND 1440),
  home_collection boolean NOT NULL DEFAULT true,
  -- Attendants: where they work (SL-04).
  care_settings text[] NOT NULL DEFAULT '{}' CHECK (care_settings <@ ARRAY['home', 'hospital']),
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_account_id, item_id)
);
CREATE INDEX listing_by_item ON app.listing (item_id) WHERE active;
COMMENT ON COLUMN app.listing.id IS 'class=Public';
COMMENT ON COLUMN app.listing.provider_account_id IS 'class=Public';
COMMENT ON COLUMN app.listing.item_id IS 'class=Public';
COMMENT ON COLUMN app.listing.fee_paise IS 'class=Public';
COMMENT ON COLUMN app.listing.duration_minutes IS 'class=Public';
COMMENT ON COLUMN app.listing.home_collection IS 'class=Public';
COMMENT ON COLUMN app.listing.care_settings IS 'class=Public';
COMMENT ON COLUMN app.listing.active IS 'class=Public';
COMMENT ON COLUMN app.listing.updated_at IS 'class=Internal';

-- Where and how a provider works: buffer between visits and travel surcharge (SL-05, AV-03).
CREATE TABLE app.provider_schedule (
  account_id uuid PRIMARY KEY REFERENCES app.account (id) ON DELETE CASCADE,
  buffer_minutes integer NOT NULL DEFAULT 15 CHECK (buffer_minutes BETWEEN 0 AND 120),
  travel_surcharge_paise integer NOT NULL DEFAULT 0 CHECK (travel_surcharge_paise BETWEEN 0 AND 100000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN app.provider_schedule.account_id IS 'class=Public';
COMMENT ON COLUMN app.provider_schedule.buffer_minutes IS 'class=Internal';
COMMENT ON COLUMN app.provider_schedule.travel_surcharge_paise IS 'class=Public';
COMMENT ON COLUMN app.provider_schedule.updated_at IS 'class=Internal';

CREATE TABLE app.service_area (
  account_id uuid NOT NULL REFERENCES app.account (id) ON DELETE CASCADE,
  pin text NOT NULL REFERENCES app.pin_code (pin),
  PRIMARY KEY (account_id, pin)
);
CREATE INDEX service_area_by_pin ON app.service_area (pin);
COMMENT ON COLUMN app.service_area.account_id IS 'class=Public';
COMMENT ON COLUMN app.service_area.pin IS 'class=Public';

-- Weekly hours in IST (AV-01, AV-04): minutes after midnight, weekday 0 is Sunday.
CREATE TABLE app.availability_rule (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES app.account (id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_minute smallint NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute smallint NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  CHECK (end_minute > start_minute)
);
CREATE INDEX availability_rule_by_account ON app.availability_rule (account_id);
COMMENT ON COLUMN app.availability_rule.id IS 'class=Internal';
COMMENT ON COLUMN app.availability_rule.account_id IS 'class=Internal';
COMMENT ON COLUMN app.availability_rule.weekday IS 'class=Internal';
COMMENT ON COLUMN app.availability_rule.start_minute IS 'class=Internal';
COMMENT ON COLUMN app.availability_rule.end_minute IS 'class=Internal';

-- Leave and date-specific closures (AV-01).
CREATE TABLE app.availability_block (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES app.account (id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  CHECK (ends_at > starts_at)
);
CREATE INDEX availability_block_by_account ON app.availability_block (account_id, starts_at);
COMMENT ON COLUMN app.availability_block.id IS 'class=Internal';
COMMENT ON COLUMN app.availability_block.account_id IS 'class=Internal';
COMMENT ON COLUMN app.availability_block.starts_at IS 'class=Internal';
COMMENT ON COLUMN app.availability_block.ends_at IS 'class=Internal';

