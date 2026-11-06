import { PG_POOL } from '../src/data-stores/data-stores.tokens.js';
import { adminSignIn, signedUp, useApp } from './account-helpers.js';
import { bearer } from './auth-helpers.js';
import { firstSlot, paidBooking } from './booking-helpers.js';
import { listedProvider } from './provider-helpers.js';
import type pg from 'pg';

describe('Totals past the 32-bit range (AD-07)', () => {
  const { app, server } = useApp();

  const restore: { id: string; paidPaise: number }[] = [];

  // The bookings stay requested with an acceptance job queued; their real paid amount is put back
  // so a later suite that runs due jobs refunds what was actually paid.
  afterAll(async () => {
    const pool = app().get<pg.Pool>(PG_POOL);
    for (const booking of restore) {
      await pool.query('UPDATE app.booking SET paid_paise = $2 WHERE id = $1', [
        booking.id,
        booking.paidPaise,
      ]);
    }
  });

  async function bookingPaid(paise: number): Promise<void> {
    const nurse = await listedProvider(app(), 'nurse', 'nursing_wound_dressing', {
      pins: ['751020'],
    });
    const patient = await signedUp(app());
    const booking = await paidBooking(app(), patient.login, {
      listingId: nurse.listingId,
      startsAt: await firstSlot(app(), nurse.accountId, nurse.listingId),
      pin: '751020',
    });
    const pool = app().get<pg.Pool>(PG_POOL);
    const { rows } = await pool.query<{ paid_paise: number }>(
      'SELECT paid_paise FROM app.booking WHERE id = $1',
      [booking.id],
    );
    restore.push({ id: booking.id, paidPaise: rows[0]?.paid_paise ?? 0 });
    await pool.query('UPDATE app.booking SET paid_paise = $2 WHERE id = $1', [booking.id, paise]);
  }

  it('AD-07 the finance view sums paid amounts above 2^31 paise without an overflow', async () => {
    await bookingPaid(2_000_000_000);
    await bookingPaid(2_000_000_000);
    const { rows } = await app()
      .get<pg.Pool>(PG_POOL)
      .query<{ paid: string }>('SELECT sum(paid_paise)::text AS paid FROM app.booking');
    const finance = await adminSignIn(app(), 'finance');
    const summary = await server().get('/admin/v1/finance').set(bearer(finance)).expect(200);
    const { paidPaise } = summary.body as { paidPaise: number };
    expect(paidPaise).toBe(Number(rows[0]?.paid));
    expect(paidPaise).toBeGreaterThan(2 ** 31);
  });
});
