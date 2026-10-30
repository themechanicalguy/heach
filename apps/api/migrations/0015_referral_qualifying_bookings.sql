-- Up Migration
-- RR-02: the qualifying event is admin-configurable: how many completed bookings the invited
-- person needs before both rewards are issued. The default keeps the first completed booking.
INSERT INTO app.setting (key, value) VALUES ('referral_qualifying_bookings', 1);
