import type pg from 'pg';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { adminSignIn, signedUp, sms, useApp } from './account-helpers.js';
import { bearer, type Login } from './auth-helpers.js';
import { bookingOf, firstSlot, paidBooking, pay } from './booking-helpers.js';
import { listedProvider } from './provider-helpers.js';
import request from 'supertest';

/** Moves a booking (and its shifts) so it starts `minutes` from now: test setup only. */
async function startIn(db: pg.Client, bookingId: string, minutes: number) {
  await db.query(
    `UPDATE app.booking SET starts_at = now() + make_interval(mins => $2), ends_at = now() + make_interval(mins => $2) + (ends_at - starts_at) WHERE id = $1`,
    [bookingId, minutes],
  );
  await db.query(
    `UPDATE app.shift s SET starts_at = b.starts_at + make_interval(days => s.day_index), ends_at = b.starts_at + make_interval(days => s.day_index) + (s.ends_at - s.starts_at)
       FROM app.booking b WHERE b.id = s.booking_id AND b.id = $1`,
    [bookingId],
  );
}

async function confirmedVisit(app: INestApplication<App>, item = 'nursing_wound_dressing') {
  const nurse = await listedProvider(app, 'nurse', item, { feePaise: 50_000 });
  const patient = await signedUp(app);
  const booking = await paidBooking(app, patient.login, {
    listingId: nurse.listingId,
    startsAt: await firstSlot(app, nurse.accountId, nurse.listingId),
  });
  await request(app.getHttpServer())
    .post(`/v1/provider/requests/${booking.id}/accept`)
    .set(bearer(nurse.login))
    .expect(204);
  return { nurse, patient, booking };
}

const codeOf = async (app: INestApplication<App>, login: Login, id: string) =>
  (await request(app.getHttpServer()).get(`/v1/bookings/${id}/code`).set(bearer(login)).expect(200))
    .body as { code: string; moment: string };

describe('The home visit (J3; HS-03, HS-04, RF-01, PY-04)', () => {
  const { app, db, server } = useApp();

  it('HS-03 the start code works only near the slot; a wrong code is refused', async () => {
    const { nurse, patient, booking } = await confirmedVisit(app());
    await startIn(db(), booking.id, 240);
    expect(
      (await server().get(`/v1/bookings/${booking.id}/code`).set(bearer(patient.login)).expect(409))
        .body,
    ).toMatchObject({ code: 'no_code_now' });
    await startIn(db(), booking.id, 5);
    const { code, moment } = await codeOf(app(), patient.login, booking.id);
    expect(moment).toBe('visit');
    const wrong = code === '000000' ? '111111' : '000000';
    expect(
      (
        await server()
          .post(`/v1/provider/bookings/${booking.id}/start`)
          .set(bearer(nurse.login))
          .send({ code: wrong })
          .expect(400)
      ).body,
    ).toMatchObject({ code: 'code_incorrect' });
    await server()
      .post(`/v1/provider/bookings/${booking.id}/start`)
      .set(bearer(nurse.login))
      .send({ code })
      .expect(204);
    expect((await bookingOf(app(), patient.login, booking.id)).status).toBe('in_progress');
    expect(
      sms(app()).sent.some(
        (message) => message.to === patient.mobile && message.templateId === 'visit_started',
      ),
    ).toBe(true);
  });

  it('HS-04 visit notes complete the booking, stay encrypted, earn the provider and allow one rating', async () => {
    const { nurse, patient, booking } = await confirmedVisit(app());
    await startIn(db(), booking.id, 5);
    const { code } = await codeOf(app(), patient.login, booking.id);
    await server()
      .post(`/v1/provider/bookings/${booking.id}/start`)
      .set(bearer(nurse.login))
      .send({ code })
      .expect(204);
    const notes = {
      procedure: 'Synthetic dressing',
      observations: 'Healing well',
      advice: 'Next visit in 3 days',
    };
    await server()
      .post(`/v1/provider/bookings/${booking.id}/complete`)
      .set(bearer(nurse.login))
      .send(notes)
      .expect(204);
    expect((await bookingOf(app(), patient.login, booking.id)).status).toBe('completed');
    const stored = await db().query<{ notes: string }>(
      'SELECT notes::text FROM app.visit WHERE booking_id = $1',
      [booking.id],
    );
    expect(stored.rows[0]?.notes).not.toContain('Healing');
    expect(
      (
        await server()
          .get(`/v1/bookings/${booking.id}/visit-notes`)
          .set(bearer(patient.login))
          .expect(200)
      ).body,
    ).toMatchObject(notes);
    const earnings = await server()
      .get('/v1/provider/earnings')
      .set(bearer(nurse.login))
      .expect(200);
    expect(earnings.body).toMatchObject({ balancePaise: 47_500 });

    await server()
      .post(`/v1/bookings/${booking.id}/review`)
      .set(bearer(patient.login))
      .send({ stars: 5, comment: 'Kind and careful' })
      .expect(201);
    await server()
      .post(`/v1/bookings/${booking.id}/review`)
      .set(bearer(patient.login))
      .send({ stars: 1 })
      .expect(409);
    const profile = await server().get(`/v1/providers/${nurse.accountId}?locale=en`).expect(200);
    expect(profile.body).toMatchObject({ rating: 5, ratingCount: 1 });
    const reviews = await server().get(`/v1/providers/${nurse.accountId}/reviews`).expect(200);
    expect(reviews.body).toEqual([
      expect.objectContaining({ stars: 5, comment: 'Kind and careful' }),
    ]);
  });
});

describe('Ratings and moderation (RF-01, RF-02)', () => {
  const { app, db, server } = useApp();

  it('RF-01 RF-02 a review is allowed only after completion; a reported review is hidden with a reason', async () => {
    const { nurse, patient, booking } = await confirmedVisit(app(), 'nursing_vitals_check');
    expect(
      (
        await server()
          .post(`/v1/bookings/${booking.id}/review`)
          .set(bearer(patient.login))
          .send({ stars: 4 })
          .expect(409)
      ).body,
    ).toMatchObject({ code: 'review_not_allowed' });
    await db().query(`UPDATE app.booking SET status = 'completed' WHERE id = $1`, [booking.id]);
    const review = (
      await server()
        .post(`/v1/bookings/${booking.id}/review`)
        .set(bearer(patient.login))
        .send({ stars: 1, comment: 'Synthetic complaint' })
        .expect(201)
    ).body as { id: string };
    await server()
      .post(`/v1/provider/reviews/${review.id}/report`)
      .set(bearer(nurse.login))
      .expect(204);
    const support = await adminSignIn(app(), 'support');
    const reported = await server().get('/admin/v1/reviews').set(bearer(support)).expect(200);
    expect((reported.body as { id: string }[]).some((row) => row.id === review.id)).toBe(true);
    await server()
      .post(`/admin/v1/reviews/${review.id}/hide`)
      .set(bearer(support))
      .send({ reason: 'abusive' })
      .expect(204);
    const visible = await server().get(`/v1/providers/${nurse.accountId}/reviews`).expect(200);
    expect((visible.body as { id: string }[]).some((row) => row.id === review.id)).toBe(false);
  });
});

describe('Attendant shifts (J4; HS-05, PK-07)', () => {
  const { app, db, server } = useApp();

  it('HS-05 each shift checks in and out with the patient code; the balance comes first; each shift earns', async () => {
    const attendant = await listedProvider(app(), 'attendant', 'attendant_day_12h', {
      feePaise: 80_000,
    });
    const patient = await signedUp(app());
    const booking = await paidBooking(app(), patient.login, {
      listingId: attendant.listingId,
      startsAt: await firstSlot(app(), attendant.accountId, attendant.listingId),
      shiftDays: 2,
    });
    await server()
      .post(`/v1/provider/requests/${booking.id}/accept`)
      .set(bearer(attendant.login))
      .expect(204);
    await startIn(db(), booking.id, -10);
    const shifts = await server()
      .get(`/v1/bookings/${booking.id}/shifts`)
      .set(bearer(patient.login))
      .expect(200);
    expect((shifts.body as { status: string }[]).map((shift) => shift.status)).toEqual([
      'scheduled',
      'scheduled',
    ]);
    const first = await codeOf(app(), patient.login, booking.id);
    expect(first.moment).toBe('shift:0:in');
    const checkIn = (day: number, code: string) =>
      server()
        .post(`/v1/provider/bookings/${booking.id}/shifts/${String(day)}/check-in`)
        .set(bearer(attendant.login))
        .send({ code });
    const checkOut = (day: number, code: string) =>
      server()
        .post(`/v1/provider/bookings/${booking.id}/shifts/${String(day)}/check-out`)
        .set(bearer(attendant.login))
        .send({ code });
    expect((await checkIn(0, first.code).expect(409)).body).toMatchObject({ code: 'balance_due' });
    const balance = await server()
      .post(`/v1/bookings/${booking.id}/balance`)
      .set(bearer(patient.login))
      .expect(200);
    await pay(app(), patient.login, (balance.body as { orderId: string }).orderId);
    await checkIn(0, first.code).expect(204);
    expect((await bookingOf(app(), patient.login, booking.id)).status).toBe('in_progress');
    await checkOut(0, (await codeOf(app(), patient.login, booking.id)).code).expect(204);
    await db().query(
      `UPDATE app.shift SET starts_at = now() - interval '5 minutes', ends_at = now() + interval '11 hours' WHERE booking_id = $1 AND day_index = 1`,
      [booking.id],
    );
    const second = await codeOf(app(), patient.login, booking.id);
    expect(second.moment).toBe('shift:1:in');
    await checkIn(1, second.code).expect(204);
    await checkOut(1, (await codeOf(app(), patient.login, booking.id)).code).expect(204);
    expect((await bookingOf(app(), patient.login, booking.id)).status).toBe('completed');
    const earnings = (
      await server().get('/v1/provider/earnings').set(bearer(attendant.login)).expect(200)
    ).body as { lines: { kind: string }[] };
    expect(earnings.lines.filter((line) => line.kind === 'earning')).toHaveLength(2);
  });
});

describe('Attendant unavailable mid-booking (A13, FU-39)', () => {
  const { app, db, server } = useApp();

  it('FU-39 cancelling after one of three shifts refunds only the two not worked', async () => {
    const attendant = await listedProvider(app(), 'attendant', 'attendant_night_12h', {
      feePaise: 90_000,
    });
    const patient = await signedUp(app());
    const booking = await paidBooking(app(), patient.login, {
      listingId: attendant.listingId,
      startsAt: await firstSlot(app(), attendant.accountId, attendant.listingId),
      shiftDays: 3,
    });
    await server()
      .post(`/v1/provider/requests/${booking.id}/accept`)
      .set(bearer(attendant.login))
      .expect(204);
    await startIn(db(), booking.id, -10);
    const balance = await server()
      .post(`/v1/bookings/${booking.id}/balance`)
      .set(bearer(patient.login))
      .expect(200);
    await pay(app(), patient.login, (balance.body as { orderId: string }).orderId);
    for (const move of ['check-in', 'check-out']) {
      const { code } = await codeOf(app(), patient.login, booking.id);
      await server()
        .post(`/v1/provider/bookings/${booking.id}/shifts/0/${move}`)
        .set(bearer(attendant.login))
        .send({ code })
        .expect(204);
    }
    const support = await adminSignIn(app(), 'support');
    await server()
      .post(`/admin/v1/bookings/${booking.id}/cancel`)
      .set(bearer(support))
      .send({ reason: 'provider_unavailable' })
      .expect(204);
    const after = await bookingOf(app(), patient.login, booking.id);
    expect(after.fees.paidPaise).toBe(after.fees.totalPaise);
    expect(after.fees.refundedPaise).toBe(
      after.fees.totalPaise - Math.round(after.fees.totalPaise / 3),
    );
  });
});

describe('Absences, strikes and safety (A12, A15, HS-06, AD-06, SE-03, SE-06)', () => {
  const { app, db, server } = useApp();

  it('A15 a patient absent after the wait pays the fee share; the rest is refunded', async () => {
    const { nurse, patient, booking } = await confirmedVisit(app(), 'nursing_vitals_check');
    await startIn(db(), booking.id, -5);
    expect(
      (
        await server()
          .post(`/v1/provider/bookings/${booking.id}/no-show`)
          .set(bearer(nurse.login))
          .expect(409)
      ).body,
    ).toMatchObject({ code: 'no_show_too_early' });
    await startIn(db(), booking.id, -20);
    await server()
      .post(`/v1/provider/bookings/${booking.id}/no-show`)
      .set(bearer(nurse.login))
      .expect(204);
    const after = await bookingOf(app(), patient.login, booking.id);
    expect(after).toMatchObject({
      status: 'refunded',
      fees: { refundedPaise: Math.round(after.fees.paidPaise / 2) },
    });
    const earnings = (
      await server().get('/v1/provider/earnings').set(bearer(nurse.login)).expect(200)
    ).body as { lines: { kind: string }[] };
    expect(earnings.lines.map((line) => line.kind)).toContain('no_show_fee');
  });

  it('A12 an absent provider refunds in full and strikes; the third strike opens a review', async () => {
    const nurse = await listedProvider(app(), 'nurse', 'nursing_iv_fluids', { pins: ['751024'] });
    const patient = await signedUp(app());
    for (const index of [0, 2, 4]) {
      const booking = await paidBooking(app(), patient.login, {
        listingId: nurse.listingId,
        pin: '751024',
        startsAt: await firstSlot(app(), nurse.accountId, nurse.listingId, index),
        prescription: {
          contentType: 'application/pdf',
          contentBase64: Buffer.from('%PDF-1.7').toString('base64'),
        },
      });
      await server()
        .post(`/v1/provider/requests/${booking.id}/accept`)
        .set(bearer(nurse.login))
        .expect(204);
      await startIn(db(), booking.id, -40 - index * 120);
      await server()
        .post(`/v1/bookings/${booking.id}/provider-no-show`)
        .set(bearer(patient.login))
        .expect(204);
      expect(await bookingOf(app(), patient.login, booking.id)).toMatchObject({
        status: 'refunded',
      });
    }
    const strikes = await db().query<{ n: number }>(
      'SELECT count(*)::int AS n FROM app.provider_strike WHERE provider_account_id = $1',
      [nurse.accountId],
    );
    expect(strikes.rows[0]?.n).toBe(3);
    const support = await adminSignIn(app(), 'support');
    const queue = (await server().get('/admin/v1/tickets').set(bearer(support)).expect(200))
      .body as { kind: string }[];
    expect(queue.some((ticket) => ticket.kind === 'strike_review')).toBe(true);
  });
});

describe('Safety concerns and break-glass (HS-06, AD-06, SE-03, SE-06)', () => {
  const { app, server } = useApp();

  it('HS-06 SE-03 a safety concern is P0; its text needs break-glass, which the patient can see', async () => {
    const { nurse, patient, booking } = await confirmedVisit(app());
    const raised = await server()
      .post('/v1/tickets')
      .set(bearer(patient.login))
      .send({
        bookingId: booking.id,
        kind: 'safety',
        topic: 'safety_threat',
        description: 'Synthetic concern text',
      })
      .expect(201);
    const ticket = raised.body as { id: string; priority: string };
    expect(ticket.priority).toBe('p0');
    const stranger = await signedUp(app());
    await server()
      .post('/v1/tickets')
      .set(bearer(stranger.login))
      .send({ bookingId: booking.id, kind: 'complaint', topic: 'other' })
      .expect(404);
    await server()
      .post('/v1/tickets')
      .set(bearer(nurse.login))
      .send({ bookingId: booking.id, kind: 'help', topic: 'billing' })
      .expect(201);
    const support = await adminSignIn(app(), 'support');
    const queue = (await server().get('/admin/v1/tickets').set(bearer(support)).expect(200))
      .body as { id: string; priority: string }[];
    expect(queue[0]?.priority).toBe('p0');
    expect(JSON.stringify(queue)).not.toContain('Synthetic concern');
    expect(
      (
        await server()
          .get(`/admin/v1/tickets/${ticket.id}/restricted`)
          .set(bearer(support))
          .expect(403)
      ).body,
    ).toMatchObject({ code: 'break_glass_required' });
    await server()
      .post(`/admin/v1/tickets/${ticket.id}/break-glass`)
      .set(bearer(support))
      .send({ reason: 'safety_investigation' })
      .expect(204);
    await server()
      .post(`/admin/v1/tickets/${ticket.id}/notes`)
      .set(bearer(support))
      .send({ note: 'Called the patient' })
      .expect(204);
    const restricted = await server()
      .get(`/admin/v1/tickets/${ticket.id}/restricted`)
      .set(bearer(support))
      .expect(200);
    expect(restricted.body).toMatchObject({
      description: 'Synthetic concern text',
      notes: ['Called the patient'],
    });
    await server().post(`/admin/v1/tickets/${ticket.id}/assign`).set(bearer(support)).expect(204);
    await server()
      .post(`/admin/v1/tickets/${ticket.id}/resolve`)
      .set(bearer(support))
      .send({ resolution: 'resolved_with_patient' })
      .expect(204);
    const history = await server()
      .get('/v1/me/access-history')
      .set(bearer(patient.login))
      .expect(200);
    expect(history.body).toEqual([
      expect.objectContaining({ adminRole: 'support', reason: 'safety_investigation' }),
    ]);
    const mine = (await server().get('/v1/tickets').set(bearer(patient.login)).expect(200))
      .body as { status: string }[];
    expect(mine[0]?.status).toBe('resolved');
  });
});
