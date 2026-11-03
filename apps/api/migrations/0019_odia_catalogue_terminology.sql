-- I18N-05: correct the original Odia catalogue names, preserving names edited by operations.
UPDATE app.catalogue_item_text AS text
SET name = 'ରକ୍ତଚାପ ଓ ନାଡ଼ି ଯାଞ୍ଚ'
FROM app.catalogue_item AS item
WHERE text.item_id = item.id AND item.code = 'nursing_vitals_check'
  AND text.locale = 'or' AND text.name = 'ଜୀବନ ଚିହ୍ନ ଯାଞ୍ଚ';

UPDATE app.catalogue_item_text AS text
SET name = 'IV ସାଲାଇନ୍'
FROM app.catalogue_item AS item
WHERE text.item_id = item.id AND item.code = 'nursing_iv_fluids'
  AND text.locale = 'or' AND text.name = 'IV ତରଳ';

UPDATE app.catalogue_item_text AS text
SET name = 'ରୋଗୀ ସହାୟକ, ୧୨ ଘଣ୍ଟା ଦିନ ପାଳି'
FROM app.catalogue_item AS item
WHERE text.item_id = item.id AND item.code = 'attendant_day_12h'
  AND text.locale = 'or' AND text.name = 'ସେବକ, ୧୨ ଘଣ୍ଟା ଦିନ ପାଳି';

UPDATE app.catalogue_item_text AS text
SET name = 'ରୋଗୀ ସହାୟକ, ୧୨ ଘଣ୍ଟା ରାତି ପାଳି'
FROM app.catalogue_item AS item
WHERE text.item_id = item.id AND item.code = 'attendant_night_12h'
  AND text.locale = 'or' AND text.name = 'ସେବକ, ୧୨ ଘଣ୍ଟା ରାତି ପାଳି';

UPDATE app.catalogue_item_text AS text
SET name = 'ରୋଗୀ ସହାୟକ, ୨୪ ଘଣ୍ଟା ଯତ୍ନ'
FROM app.catalogue_item AS item
WHERE text.item_id = item.id AND item.code = 'attendant_24h'
  AND text.locale = 'or' AND text.name = 'ସେବକ, ୨୪ ଘଣ୍ଟା ଯତ୍ନ';
