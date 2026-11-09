-- BK-01, BK-05: what the provider needs to know before a physiotherapy visit (reason, affected
-- area, age, who will be at the address). One encrypted JSON document, read where notes are read.
ALTER TABLE app.booking ADD COLUMN intake app.encrypted_field;
COMMENT ON COLUMN app.booking.intake IS 'class=Restricted';
