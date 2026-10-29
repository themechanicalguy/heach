import { BookingTimers } from '../src/bookings/booking-timers.js';
import { withTransaction } from '../src/data-stores/transaction.js';
import { PG_POOL } from '../src/data-stores/data-stores.tokens.js';
import { LedgerService } from '../src/payouts/ledger.service.js';
import { Settings } from '../src/settings/settings.service.js';
import { adminSignIn, signedUp, useApp } from './account-helpers.js';
import { bearer } from './auth-helpers.js';
import {
  type Booking,
  bookingOf,
  createBooking,
  firstSlot,
  gateway,
  paidBooking,
  pay,
  runJobs,
} from './booking-helpers.js';
import { listedProvider, PILOT_PIN } from './provider-helpers.js';
import type pg from 'pg';

describe('Any available provider (amendment A10)', () => {
  const { app, server } = useApp();

  it('A10 waves reach every eligible provider; the first accept wins and a price difference is refunded', async () => {
    const pins = ['751017'];
    const cheap = await listedProvider(app(), 'physiotherapist', 'physio_neuro_rehab', {
      feePaise: 50_000,
      pins,
    });
    const dear = await listedProvider(app(), 'physiotherapist', 'physio_neuro_rehab', {
      feePaise: 70_000,
      pins,
    });
    const quote = await server()
      .get('/v1/search/any-slots?item=physio_neuro_rehab&pin=751017')
      .expect(200);
    const { slots, quotePaise, providers } = quote.body as {
      slots: string[];
      quotePaise: number;
      providers: number;
    };
    expect(providers).toBeGreaterThanOrEqual(2);
    expect(quotePaise).toBeGreaterThanOrEqual(75_000);
    const patient = await signedUp(app());
    const booking = await paidBooking(app(), patient.login, {
      itemCode: 'physio_neuro_rehab',
      startsAt: slots[0],
      pin: '751017',
    });
    expect(booking).toMatchObject({ status: 'requested', provider: null });
    // Earlier local runs leave more providers in this PIN code: one wide wave reaches both here.
    const settings = app().get(Settings);
    await settings.set('dispatch_wave_size', 500);
    await runJobs(app()).finally(() => settings.set('dispatch_wave_size', 3));
    const offered = async (login: Parameters<typeof bearer>[0]) =>
      (
        (await server().get('/v1/provider/requests').set(bearer(login)).expect(200)).body as {
          bookingId: string;
        }[]
      ).some((row) => row.bookingId === booking.id);
    expect([await offered(cheap.login), await offered(dear.login)]).toEqual([true, true]);
    const answers = await Promise.all([
      server().post(`/v1/provider/requests/${booking.id}/accept`).set(bearer(cheap.login)),
      server().post(`/v1/provider/requests/${booking.id}/accept`).set(bearer(dear.login)),
    ]);
    expect(answers.map((answer) => answer.status).sort((a, b) => a - b)).toEqual([204, 409]);
    const after = await bookingOf(app(), patient.login, booking.id);
    expect(after.status).toBe('confirmed');
    const winner = answers[0].status === 204 ? cheap : dear;
    expect(after.provider?.id).toBe(winner.accountId);
    expect(after.fees.refundedPaise).toBe(after.fees.paidPaise - after.fees.advancePaise);
  });

  it('SD-03 a gender preference is never relaxed: no match leaves the request to lapse and refund', async () => {
    await listedProvider(app(), 'nurse', 'nursing_iv_fluids', { pins: ['751019'] });
    const patient = await signedUp(app());
    const quote = (
      await server()
        .get('/v1/search/any-slots?item=nursing_iv_fluids&pin=751019&gender=male')
        .expect(200)
    ).body as { providers: number };
    expect(quote.providers).toBe(0);
    const any = (
      await server().get('/v1/search/any-slots?item=nursing_iv_fluids&pin=751019').expect(200)
    ).body as { slots: string[] };
    const refused = await createBooking(app(), patient.login, {
      itemCode: 'nursing_iv_fluids',
      startsAt: any.slots[0],
      pin: '751019',
      genderPreference: 'male',
      prescription: {
        contentType: 'application/pdf',
        contentBase64: Buffer.from('%PDF-1.7').toString('base64'),
      },
    });
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ code: 'no_provider' });
  });
});

describe('Attendant shifts to payment, payouts and reconciliation (J4; Q-ADVANCE, PY-04, PY-05, LM-06)', () => {
  const { app, server } = useApp();

  it('Q-ADVANCE a 3-day attendant booking pays 30 % first and the balance once confirmed', async () => {
    const attendant = await listedProvider(app(), 'attendant', 'attendant_24h', {
      feePaise: 100_000,
    });
    const patient = await signedUp(app());
    const startsAt = await firstSlot(app(), attendant.accountId, attendant.listingId);
    const booking = await paidBooking(app(), patient.login, {
      listingId: attendant.listingId,
      startsAt,
      shiftDays: 3,
    });
    expect(booking.fees).toMatchObject({
      totalPaise: 300_000,
      advancePaise: 90_000,
      paidPaise: 90_000,
    });
    await server()
      .post(`/v1/bookings/${booking.id}/balance`)
      .set(bearer(patient.login))
      .expect(409);
    await server()
      .post(`/v1/provider/requests/${booking.id}/accept`)
      .set(bearer(attendant.login))
      .expect(204);
    expect((await bookingOf(app(), patient.login, booking.id)).fees.balanceDuePaise).toBe(210_000);
    const balance = await server()
      .post(`/v1/bookings/${booking.id}/balance`)
      .set(bearer(patient.login))
      .expect(200);
    expect(balance.body).toMatchObject({ amountPaise: 210_000 });
    await pay(app(), patient.login, (balance.body as { orderId: string }).orderId);
    expect((await bookingOf(app(), patient.login, booking.id)).fees).toMatchObject({
      paidPaise: 300_000,
      balanceDuePaise: 0,
    });
  });

  it('PY-05 the payout run settles available earnings once; a later refund is reversed from the next', async () => {
    const nurse = await listedProvider(app(), 'nurse', 'nursing_vitals_check', {
      feePaise: 40_000,
    });
    const patient = await signedUp(app());
    const booking = await paidBooking(app(), patient.login, {
      listingId: nurse.listingId,
      startsAt: await firstSlot(app(), nurse.accountId, nurse.listingId),
    });
    const ledger = app().get(LedgerService);
    const pool = app().get<pg.Pool>(PG_POOL);
    await withTransaction(pool, (client) =>
      ledger.earn(client, {
        providerId: nurse.accountId,
        bookingId: booking.id,
        amountPaise: 39_000,
        kind: 'earning',
        at: new Date(Date.now() - 72 * 3_600_000),
      }),
    );
    const run = await ledger.runPayouts(new Date());
    expect(run.providers).toBeGreaterThanOrEqual(1);
    expect(
      gateway(app()).transfers.some(
        (transfer) => transfer.providerId === nurse.accountId && transfer.amountPaise === 39_000,
      ),
    ).toBe(true);
    expect((await ledger.runPayouts(new Date())).totalPaise).toBe(0);
    await withTransaction(pool, (client) => ledger.reverse(client, booking.id, 10_000));
    const earnings = await server()
      .get('/v1/provider/earnings')
      .set(bearer(nurse.login))
      .expect(200);
    expect(earnings.body).toMatchObject({ balancePaise: -10_000, paidOutPaise: 39_000 });
  });
});

describe('Reconciliation and the admin console (LM-06, AD-05, AD-07)', () => {
  const { app, server } = useApp();

  it('LM-06 reconciliation finds a payment the gateway does not know as paid', async () => {
    const physio = await listedProvider(app(), 'physiotherapist', 'physio_assessment');
    const patient = await signedUp(app());
    const booking = await paidBooking(app(), patient.login, {
      listingId: physio.listingId,
      startsAt: await firstSlot(app(), physio.accountId, physio.listingId),
    });
    const timers = app().get(BookingTimers);
    const clean = await timers.reconcile(new Date(Date.now() + 1000));
    const order = [...gateway(app()).orders.entries()].find(
      ([, value]) => value.receipt === booking.id,
    );
    if (order) order[1].paid = false;
    expect(await timers.reconcile(new Date(Date.now() + 1000))).toBe(clean + 1);
  });

  it('AD-05 AD-07 support sees masked bookings and reassigns; finance refunds manually and exports', async () => {
    const pins = ['751020'];
    const nurse = await listedProvider(app(), 'nurse', 'nursing_wound_dressing', { pins });
    const replacement = await listedProvider(app(), 'nurse', 'nursing_wound_dressing', { pins });
    const patient = await signedUp(app());
    const booking = await paidBooking(app(), patient.login, {
      listingId: nurse.listingId,
      startsAt: await firstSlot(app(), nurse.accountId, nurse.listingId),
      pin: '751020',
    });
    await server()
      .post(`/v1/provider/requests/${booking.id}/accept`)
      .set(bearer(nurse.login))
      .expect(204);
    const support = await adminSignIn(app(), 'support');
    const list = await server()
      .get('/admin/v1/bookings?status=confirmed')
      .set(bearer(support))
      .expect(200);
    const row = (list.body as Booking[]).find((entry) => entry.id === booking.id);
    expect(row?.provider?.name).toContain('•');
    expect(JSON.stringify(list.body)).not.toContain('Synthetic Lane');
    await server()
      .post(`/admin/v1/bookings/${booking.id}/reassign`)
      .set(bearer(support))
      .send({ listingId: replacement.listingId })
      .expect(204);
    expect((await bookingOf(app(), patient.login, booking.id)).provider?.id).toBe(
      replacement.accountId,
    );
    await server()
      .post(`/admin/v1/bookings/${booking.id}/refund`)
      .set(bearer(support))
      .send({ amountPaise: 100, reason: 'goodwill' })
      .expect(403);
    const finance = await adminSignIn(app(), 'finance');
    await server()
      .post(`/admin/v1/bookings/${booking.id}/refund`)
      .set(bearer(finance))
      .send({ amountPaise: 1_000, reason: 'goodwill' })
      .expect(204);
    await server()
      .post(`/admin/v1/bookings/${booking.id}/refund`)
      .set(bearer(finance))
      .send({ amountPaise: 10_000_000, reason: 'goodwill' })
      .expect(400);
    expect((await bookingOf(app(), patient.login, booking.id)).fees.refundedPaise).toBe(1_000);
    const csv = await server().get('/admin/v1/finance/export.csv').set(bearer(finance)).expect(200);
    expect(csv.text.split('\n')[0]).toBe(
      'booking_id,status,item,created,total_paise,paid_paise,refunded_paise,commission_paise',
    );
    const summary = await server().get('/admin/v1/finance').set(bearer(finance)).expect(200);
    expect(summary.body).toMatchObject({ commissionBps: 1500 });
    await server().post('/admin/v1/finance/payout-runs').set(bearer(finance)).expect(200);
    const notifications = await server()
      .get('/v1/me/notifications')
      .set(bearer(patient.login))
      .expect(200);
    expect((notifications.body as { template: string }[]).map((note) => note.template)).toContain(
      'booking_confirmed',
    );
    await server().post('/v1/me/notifications/read').set(bearer(patient.login)).expect(204);
    expect(PILOT_PIN).toBe('751001');
  });
});
