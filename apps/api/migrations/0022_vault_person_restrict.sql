-- Up Migration
-- MV-01, MV-12: removing a linked patient must never delete their health records or history
-- (issued records cannot be deleted at all). Removal is refused while either exists.
ALTER TABLE app.vault_record
  DROP CONSTRAINT vault_record_linked_patient_id_fkey,
  ADD CONSTRAINT vault_record_linked_patient_id_fkey
    FOREIGN KEY (linked_patient_id) REFERENCES app.linked_patient (id) ON DELETE RESTRICT;
ALTER TABLE app.history_entry
  DROP CONSTRAINT history_entry_linked_patient_id_fkey,
  ADD CONSTRAINT history_entry_linked_patient_id_fkey
    FOREIGN KEY (linked_patient_id) REFERENCES app.linked_patient (id) ON DELETE RESTRICT;
