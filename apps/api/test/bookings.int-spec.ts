import { signedUp, sms, useApp } from './account-helpers.js';
import { bearer } from './auth-helpers.js';
import {
  type Booking,
  bookingOf,
  createBooking,
  firstSlot,
  gateway,
  paidBooking,
  pay,
  PRESCRIPTION,
  runJobs,
} from './booking-helpers.js';
import { listedProvider } from './provider-helpers.js';

describe('Booking a chosen provider, to confirmation (J3; BK-01 to BK-03, BK-06, PY-01, HS-02)', () => {
  const { app, db, server } = useApp();

  it('J3 checkout, sandbox payment, request, acceptance and the address after confirmation', async () => {
    const nurse = await listedProvider(app(), 'nurse', 'nursing_wound_dressing', {
      feePaise: 50_000,
    });
    const patient = await signedUp(app());
    const startsAt = await firstSlot(app(), nurse.accountId, nurse.listingId);
    const created = (
      await createBooking(app(), patient.login, {
        listingId: nurse.listingId,
        startsAt,
        notes: 'Synthetic note',
      }).expect(201)
    ).body as Booking;
    expect(created).toMatchObject({
      status: 'pending_payment',
      fees: { totalPaise: 55_000, advancePaise: 55_000 },
    });
    expect(created.checkout).toMatchObject({ amountPaise: 55_000, sandbox: true });

    await pay(app(), patient.login, created.checkout?.orderId ?? '');
    expect((await bookingOf(app(), patient.login, created.id)).status).toBe('requested');
    expect(
      sms(app()).sent.some(
        (message) => message.to === nurse.mobile && message.templateId === 'booking_request',
      ),
    ).toBe(true);

    const requests = await server()
      .get('/v1/provider/requests?locale=en')
      .set(bearer(nurse.login))
      .expect(200);
    const offer = (
      requests.body as { bookingId: string; notes: string | null; earningPaise: number }[]
    ).find((row) => row.bookingId === created.id);
    expect(offer).toMatchObject({ notes: 'Synthetic note', earningPaise: 47_500 });
    expect(JSON.stringify(requests.body)).not.toContain('Synthetic Lane');
    await server().get(`/v1/provider/bookings/${created.id}`).set(bearer(nurse.login)).expect(404);

    await server()
      .post(`/v1/provider/requests/${created.id}/accept`)
      .set(bearer(nurse.login))
      .expect(204);
    const confirmed = await bookingOf(app(), patient.login, created.id);
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.events.map((event) => event.toStatus)).toEqual(['requested', 'confirmed']);
    const view = await server()
      .get(`/v1/provider/bookings/${created.id}`)
      .set(bearer(nurse.login))
      .expect(200);
    expect(view.body).toMatchObject({
      address: '12 Synthetic Lane, Bhubaneswar',
      contactMobile: patient.mobile,
    });
    const reminders = await db().query(
      `SELECT dedupe_key FROM app.job WHERE dedupe_key LIKE $1 ORDER BY dedupe_key`,
      [`remind:${created.id}:%`],
    );
    expect(reminders.rows.length).toBeGreaterThanOrEqual(1);
    const stored = await db().query<{ address: string }>(
      'SELECT address::text FROM app.booking WHERE id = $1',
      [created.id],
    );
    expect(stored.rows[0]?.address).not.toContain('Synthetic Lane');
  });

  it('AV-02 a second patient cannot take a slot another is paying for', async () => {
    const physio = await listedProvider(app(), 'physiotherapist', 'physio_ortho_rehab');
    const startsAt = await firstSlot(app(), physio.accountId, physio.listingId);
    const [first, second] = [await signedUp(app()), await signedUp(app())];
    await createBooking(app(), first.login, { listingId: physio.listingId, startsAt }).expect(201);
    expect(
      (
        await createBooking(app(), second.login, { listingId: physio.listingId, startsAt }).expect(
          409,
        )
      ).body,
    ).toMatchObject({ code: 'slot_taken' });
  });
});

describe('Payment webhooks and the acceptance window (PY-01, BK-03)', () => {
  const { app, server } = useApp();

  it('PY-01 webhooks need a valid signature, and a duplicate is acknowledged once', async () => {
    const nurse = await listedProvider(app(), 'nurse', 'nursing_vitals_check');
    const patient = await signedUp(app());
    const startsAt = await firstSlot(app(), nurse.accountId, nurse.listingId);
    const created = (
      await createBooking(app(), patient.login, { listingId: nurse.listingId, startsAt }).expect(
        201,
      )
    ).body as Booking;
    const event = gateway(app()).sandboxCapture(
      created.checkout?.orderId ?? '',
      `evt_dup_${String(Date.now())}`,
    );
    await server()
      .post('/v1/payments/webhook')
      .set('x-gateway-signature', 'bad')
      .set('Content-Type', 'application/json')
      .send(event.body)
      .expect(400);
    const first = await server()
      .post('/v1/payments/webhook')
      .set('x-gateway-signature', event.signature)
      .set('Content-Type', 'application/json')
      .send(event.body)
      .expect(200);
    const again = await server()
      .post('/v1/payments/webhook')
      .set('x-gateway-signature', event.signature)
      .set('Content-Type', 'application/json')
      .send(event.body)
      .expect(200);
    expect([first.body, again.body]).toEqual([{ outcome: 'processed' }, { outcome: 'duplicate' }]);
    expect((await bookingOf(app(), patient.login, created.id)).fees.paidPaise).toBe(
      created.fees.advancePaise,
    );
  });

  it('BK-03 an unanswered request lapses, cancels and refunds in full', async () => {
    const physio = await listedProvider(app(), 'physiotherapist', 'physio_geriatric');
    const patient = await signedUp(app());
    const booking = await paidBooking(app(), patient.login, {
      listingId: physio.listingId,
      startsAt: await firstSlot(app(), physio.accountId, physio.listingId),
    });
    await runJobs(app(), 31);
    const after = await bookingOf(app(), patient.login, booking.id);
    expect(after).toMatchObject({
      status: 'refunded',
      cancelledBy: 'system',
      statusReason: 'not_accepted',
    });
    expect(after.fees.refundedPaise).toBe(after.fees.paidPaise);
  });

  it('SL-06 A14 a prescription is required, reviewed by the provider, and an invalid one refunds in full', async () => {
    const nurse = await listedProvider(app(), 'nurse', 'nursing_injection');
    const patient = await signedUp(app());
    const startsAt = await firstSlot(app(), nurse.accountId, nurse.listingId);
    expect(
      (
        await createBooking(app(), patient.login, { listingId: nurse.listingId, startsAt }).expect(
          400,
        )
      ).body,
    ).toMatchObject({ code: 'prescription_required' });
    const booking = await paidBooking(app(), patient.login, {
      listingId: nurse.listingId,
      startsAt,
      prescription: PRESCRIPTION,
    });
    const file = await server()
      .get(`/v1/provider/requests/${booking.id}/prescription`)
      .set(bearer(nurse.login))
      .expect(200);
    expect(file.body).toMatchObject({ contentType: 'application/pdf' });
    await server()
      .post(`/v1/provider/requests/${booking.id}/decline`)
      .set(bearer(nurse.login))
      .send({ reason: 'prescription_invalid' })
      .expect(204);
    expect(await bookingOf(app(), patient.login, booking.id)).toMatchObject({
      status: 'refunded',
      cancelledBy: 'provider',
    });
  });
});

describe('Cancellation policy and access (BK-04, SE-01)', () => {
  const { app, server } = useApp();

  it('BK-04 a late patient cancellation refunds the policy share; an unpaid checkout expires', async () => {
    const physio = await listedProvider(app(), 'physiotherapist', 'physio_post_operative', {
      feePaise: 40_000,
    });
    const patient = await signedUp(app());
    const startsAt = await firstSlot(app(), physio.accountId, physio.listingId);
    const booking = await paidBooking(app(), patient.login, {
      listingId: physio.listingId,
      startsAt,
    });
    await server()
      .post(`/v1/provider/requests/${booking.id}/accept`)
      .set(bearer(physio.login))
      .expect(204);
    expect((await bookingOf(app(), patient.login, booking.id)).refundIfCancelledPaise).toBe(22_500);
    const cancelled = await server()
      .post(`/v1/bookings/${booking.id}/cancel`)
      .set(bearer(patient.login))
      .send({ reason: 'changed_plans' })
      .expect(200);
    expect(cancelled.body).toMatchObject({
      status: 'refunded',
      cancelledBy: 'patient',
      fees: { refundedPaise: 22_500 },
    });

    const unpaid = (
      await createBooking(app(), patient.login, {
        listingId: physio.listingId,
        startsAt: await firstSlot(app(), physio.accountId, physio.listingId, 4),
      }).expect(201)
    ).body as Booking;
    await runJobs(app(), 16);
    expect((await bookingOf(app(), patient.login, unpaid.id)).status).toBe('cancelled');
  });

  it('SE-01 another patient cannot see or cancel the booking', async () => {
    const nurse = await listedProvider(app(), 'nurse', 'nursing_catheter_care');
    const owner = await signedUp(app());
    const booking = await paidBooking(app(), owner.login, {
      listingId: nurse.listingId,
      startsAt: await firstSlot(app(), nurse.accountId, nurse.listingId),
      prescription: PRESCRIPTION,
    });
    const stranger = await signedUp(app());
    await server().get(`/v1/bookings/${booking.id}`).set(bearer(stranger.login)).expect(404);
    await server()
      .post(`/v1/bookings/${booking.id}/cancel`)
      .set(bearer(stranger.login))
      .send({ reason: 'other' })
      .expect(404);
    const other = await listedProvider(app(), 'nurse', 'nursing_catheter_care');
    await server()
      .post(`/v1/provider/requests/${booking.id}/accept`)
      .set(bearer(other.login))
      .expect(404);
    await server()
      .get(`/v1/provider/requests/${booking.id}/prescription`)
      .set(bearer(other.login))
      .expect(404);
  });
});
