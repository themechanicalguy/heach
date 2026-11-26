import { adminSignIn, signedUp, useApp } from './account-helpers.js';
import { bearer } from './auth-helpers.js';
import {
  type Booking,
  bookingOf,
  createBooking,
  firstSlot,
  gateway,
  paidBooking,
} from './booking-helpers.js';
import { listedProvider } from './provider-helpers.js';

/**
 * A provider is never booked twice for overlapping times, however the bookings go live (AV-02):
 * paid at the same moment, covered by a plan, accepted, or reassigned by support.
 */
describe('Overlapping bookings for one provider (AV-02)', () => {
  const { app, server } = useApp();

  it('AV-02 two overlapping bookings paid at the same moment: one goes live, the other is refunded', async () => {
    const nurse = await listedProvider(app(), 'nurse', 'nursing_vitals_check');
    const first = await signedUp(app());
    const second = await signedUp(app());
    // 45-minute visits on a 30-minute grid: the second slot overlaps the first.
    const starts = [
      await firstSlot(app(), nurse.accountId, nurse.listingId, 0),
      await firstSlot(app(), nurse.accountId, nurse.listingId, 1),
    ];
    const created = await Promise.all(
      [first, second].map(
        async (patient, index) =>
          (
            await createBooking(app(), patient.login, {
              listingId: nurse.listingId,
              startsAt: starts[index],
            }).expect(201)
          ).body as Booking,
      ),
    );
    const paid = created.map((booking) => {
      const { body, signature } = gateway(app()).sandboxCapture(booking.checkout?.orderId ?? '');
      return server()
        .post('/v1/payments/webhook')
        .set('x-gateway-signature', signature)
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(200);
    });
    await Promise.all(paid);
    const after = await Promise.all(
      [first, second].map((patient, index) =>
        bookingOf(app(), patient.login, created[index]?.id ?? ''),
      ),
    );
    const statuses = after.map((booking) => booking.status).sort((a, b) => a.localeCompare(b));
    // The loser is cancelled as slot_taken and refunded in full straight away.
    expect(statuses).toEqual(['refunded', 'requested']);
    expect(after.find((booking) => booking.status === 'refunded')?.statusReason).toBe('slot_taken');
  });
});

describe('Reassigning a booking (AD-05)', () => {
  const { app, server } = useApp();

  it('AD-05 a reassigned shift booking moves its shifts and ends the old provider’s view of shared records', async () => {
    const pins = ['751024'];
    const before = await listedProvider(app(), 'attendant', 'attendant_24h', { pins });
    const after = await listedProvider(app(), 'attendant', 'attendant_24h', { pins });
    const patient = await signedUp(app());
    const booking = await paidBooking(app(), patient.login, {
      listingId: before.listingId,
      startsAt: await firstSlot(app(), before.accountId, before.listingId),
      pin: '751024',
      shiftDays: 2,
    });
    await server()
      .post(`/v1/provider/requests/${booking.id}/accept`)
      .set(bearer(before.login))
      .expect(204);
    await server()
      .post('/v1/vault/shares')
      .set(bearer(patient.login))
      .send({ bookingId: booking.id, recordIds: [], includeHistory: true })
      .expect(201);
    const support = await adminSignIn(app(), 'support');
    await server()
      .post(`/admin/v1/bookings/${booking.id}/reassign`)
      .set(bearer(support))
      .send({ listingId: after.listingId })
      .expect(204);

    const shifts = (
      await server()
        .get(`/v1/provider/bookings/${booking.id}/shifts`)
        .set(bearer(after.login))
        .expect(200)
    ).body as unknown[];
    expect(shifts).toHaveLength(2);
    const old = await server()
      .get(`/v1/provider/bookings/${booking.id}/shared`)
      .set(bearer(before.login))
      .expect(200);
    expect(old.body).toEqual({ records: [], history: [], files: [] });
  });

  it('AD-05 a booking is not reassigned to a provider who charges a different price', async () => {
    const pins = ['751020'];
    const nurse = await listedProvider(app(), 'nurse', 'nursing_wound_dressing', { pins });
    const dearer = await listedProvider(app(), 'nurse', 'nursing_wound_dressing', {
      pins,
      feePaise: 90_000,
    });
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
    const refused = await server()
      .post(`/admin/v1/bookings/${booking.id}/reassign`)
      .set(bearer(support))
      .send({ listingId: dearer.listingId });
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ code: 'reassign_price_differs' });
  });
});
