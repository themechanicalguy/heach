import { BookingTimers } from '../src/bookings/booking-timers.js';
import { adminSignIn, nextTotp, signedUp, useApp } from './account-helpers.js';
import { bearer, type Login } from './auth-helpers.js';
import {
  bookingOf,
  completedVisit,
  createBooking,
  firstSlot,
  gateway,
  runJobs,
  type Booking,
} from './booking-helpers.js';
import { buy, packagePlan, plansOf, texts } from './plan-helpers.js';
import { listedProvider } from './provider-helpers.js';

describe('Packages and entitlements (J8; PK-01, PK-03, PK-04, PK-07, BK-08)', () => {
  const { app, server } = useApp();

  it('PK-04 BK-08 a package pays the fee; travel is still paid; cancelling the booking gives the unit back', async () => {
    const physio = await listedProvider(app(), 'physiotherapist', 'physio_ortho_rehab', {
      feePaise: 60_000,
    });
    const planId = await packagePlan(app(), 'physio_ortho_rehab', 3, 150_000);
    const listed = (await server().get('/v1/plans?locale=en&service=physiotherapy').expect(200))
      .body as { id: string; inclusions: string }[];
    expect(listed.find((plan) => plan.id === planId)?.inclusions).toBe('Synthetic inclusions');
    const patient = await signedUp(app());
    const purchaseId = await buy(app(), patient.login, planId);
    expect((await plansOf(app(), patient.login))[0]).toMatchObject({
      status: 'active',
      entitlements: [{ unitsTotal: 3, unitsUsed: 0 }],
    });
    const created = (
      await createBooking(app(), patient.login, {
        listingId: physio.listingId,
        startsAt: await firstSlot(app(), physio.accountId, physio.listingId),
        purchaseId,
      }).expect(201)
    ).body as Booking;
    expect(created.fees).toMatchObject({ feePaise: 60_000, totalPaise: 5_000 });
    expect((await plansOf(app(), patient.login))[0]?.entitlements[0]?.unitsUsed).toBe(1);
    await server()
      .post(`/v1/bookings/${created.id}/cancel`)
      .set(bearer(patient.login))
      .send({ reason: 'changed_plans' })
      .expect(200);
    expect((await plansOf(app(), patient.login))[0]?.entitlements[0]?.unitsUsed).toBe(0);
  });

  it('BK-08 a booking fully covered needs no payment and goes straight to the provider', async () => {
    const attendant = await listedProvider(app(), 'attendant', 'attendant_day_12h', {
      feePaise: 80_000,
    });
    const planId = await packagePlan(app(), 'attendant_day_12h', 2, 140_000);
    const patient = await signedUp(app());
    const purchaseId = await buy(app(), patient.login, planId);
    const created = (
      await createBooking(app(), patient.login, {
        listingId: attendant.listingId,
        startsAt: await firstSlot(app(), attendant.accountId, attendant.listingId),
        shiftDays: 2,
        purchaseId,
      }).expect(201)
    ).body as Booking;
    expect(created).toMatchObject({ status: 'requested', checkout: null, fees: { totalPaise: 0 } });
    await createBooking(app(), patient.login, {
      listingId: attendant.listingId,
      startsAt: await firstSlot(app(), attendant.accountId, attendant.listingId, 2),
      purchaseId,
    }).expect(409);
  });

  it('PK-01 a provider package waits for admin approval before sale', async () => {
    const nurse = await listedProvider(app(), 'nurse', 'nursing_wound_dressing');
    const own = await server()
      .post('/v1/provider/plans')
      .set(bearer(nurse.login))
      .send({
        kind: 'package',
        itemCode: 'nursing_wound_dressing',
        units: 7,
        discountPercent: 0,
        familyMembers: 0,
        validityDays: 30,
        pricePaise: 250_000,
        texts: texts('Seven dressings'),
      })
      .expect(201);
    const id = (own.body as { id: string }).id;
    const visible = async () =>
      ((await server().get('/v1/plans?locale=en').expect(200)).body as { id: string }[]).some(
        (plan) => plan.id === id,
      );
    expect(await visible()).toBe(false);
    const admin = await adminSignIn(app(), 'super_admin');
    await server().post(`/admin/v1/plans/${id}/approve`).set(bearer(admin)).expect(204);
    expect(await visible()).toBe(true);
  });
});

describe('Referrals and coupons (RR-01 to RR-08, AD-16)', () => {
  const { app, db, server } = useApp();

  it('RR-03 a coupon comes only after the invitee completes a first booking, and is used once', async () => {
    const referrer = await signedUp(app());
    const { code } = (await server().get('/v1/me/referral').set(bearer(referrer.login)).expect(200))
      .body as { code: string };
    expect(code).toMatch(/^[A-Z0-9]{8}$/);
    await server()
      .post('/v1/me/referral/join')
      .set(bearer(referrer.login))
      .send({ code })
      .expect(409);
    const invitee = await signedUp(app());
    await server()
      .post('/v1/me/referral/join')
      .set(bearer(invitee.login))
      .send({ code })
      .expect(204);
    await server()
      .post('/v1/me/referral/join')
      .set(bearer(invitee.login))
      .send({ code })
      .expect(409);
    const coupons = async (login: Login) =>
      (
        (await server().get('/v1/me/referral').set(bearer(login)).expect(200)).body as {
          coupons: { id: string; status: string; valuePaise: number }[];
        }
      ).coupons;
    expect(await coupons(referrer.login)).toEqual([]);

    const nurse = await listedProvider(app(), 'nurse', 'nursing_wound_dressing', {
      feePaise: 40_000,
    });
    await completedVisit(app(), db(), invitee.login, nurse);
    await runJobs(app());
    const [reward] = await coupons(referrer.login);
    expect(reward).toMatchObject({ status: 'active', valuePaise: 10_000 });
    const [welcome] = await coupons(invitee.login);
    expect(welcome?.valuePaise).toBe(5_000);
    const invitees = (
      (await server().get('/v1/me/referral').set(bearer(referrer.login)).expect(200)).body as {
        invitees: { status: string }[];
      }
    ).invitees;
    expect(invitees).toEqual([expect.objectContaining({ status: 'rewarded' })]);

    const second = (
      await createBooking(app(), invitee.login, {
        listingId: nurse.listingId,
        startsAt: await firstSlot(app(), nurse.accountId, nurse.listingId, 3),
        couponId: welcome?.id,
      }).expect(201)
    ).body as Booking;
    expect(second.fees).toMatchObject({ discountPaise: 5_000, totalPaise: 40_000 });
    await createBooking(app(), invitee.login, {
      listingId: nurse.listingId,
      startsAt: await firstSlot(app(), nurse.accountId, nurse.listingId, 5),
      couponId: welcome?.id,
    }).expect(404);
    const support = await adminSignIn(app(), 'support');
    await server()
      .post(`/admin/v1/coupons/${reward?.id ?? ''}/cancel`)
      .set(bearer(support))
      .expect(204);
    expect((await coupons(referrer.login))[0]?.status).toBe('cancelled');
    expect((await bookingOf(app(), invitee.login, second.id)).fees.discountPaise).toBe(5_000);
  });
});

describe('Admin console (AD-08, AD-10, AD-17)', () => {
  const { app, server } = useApp();

  it('AD-08 settings change only with a fresh TOTP code; AD-10 dashboard; AD-17 security for super admin only', async () => {
    const admin = await adminSignIn(app(), 'super_admin');
    const settings = (await server().get('/admin/v1/settings').set(bearer(admin)).expect(200))
      .body as { key: string; value: number }[];
    expect(settings.find((row) => row.key === 'commission_bps')?.value).toBe(1500);
    await server()
      .put('/admin/v1/settings')
      .set(bearer(admin))
      .send({ key: 'acceptance_window_minutes', value: 45 })
      .expect(403);
    await server()
      .post('/admin/v1/auth/reverify')
      .set(bearer(admin))
      .send({ code: nextTotp(admin.secret) })
      .expect(204);
    await server()
      .put('/admin/v1/settings')
      .set(bearer(admin))
      .send({ key: 'acceptance_window_minutes', value: 45 })
      .expect(204);
    await server()
      .put('/admin/v1/settings')
      .set(bearer(admin))
      .send({ key: 'acceptance_window_minutes', value: 30 })
      .expect(204);
    const dashboard = (await server().get('/admin/v1/dashboard').set(bearer(admin)).expect(200))
      .body as { signUps: number; bookingsByStatus: unknown[] };
    expect(dashboard.signUps).toBeGreaterThan(0);
    expect(Array.isArray(dashboard.bookingsByStatus)).toBe(true);
    await server().get('/admin/v1/security').set(bearer(admin)).expect(200);
    const support = await adminSignIn(app(), 'support');
    await server().get('/admin/v1/security').set(bearer(support)).expect(403);
    await server()
      .put('/admin/v1/settings')
      .set(bearer(support))
      .send({ key: 'commission_bps', value: 0 })
      .expect(403);
    await server().get('/admin/v1/referrals?status=flagged').set(bearer(support)).expect(200);
  });
});

describe('Entitlement ledger invariants (PK-04, Step 9 checks)', () => {
  const { app, server } = useApp();

  it('PK-04 a discount-only booking on a used-up package gives back no unit when cancelled', async () => {
    const physio = await listedProvider(app(), 'physiotherapist', 'physio_neuro_rehab', {
      feePaise: 50_000,
    });
    const timers = app().get(BookingTimers);
    const mismatchesBefore = await timers.ledgerMismatches();
    const planId = await packagePlan(app(), 'physio_neuro_rehab', 1, 45_000, 20);
    const patient = await signedUp(app());
    const purchaseId = await buy(app(), patient.login, planId);
    const book = async (nth: number) =>
      (
        await createBooking(app(), patient.login, {
          listingId: physio.listingId,
          startsAt: await firstSlot(app(), physio.accountId, physio.listingId, nth * 4),
          purchaseId,
        }).expect(201)
      ).body as Booking;
    await book(0);
    const discounted = await book(1);
    expect(discounted.fees).toMatchObject({ discountPaise: 10_000 });
    await server()
      .post(`/v1/bookings/${discounted.id}/cancel`)
      .set(bearer(patient.login))
      .send({ reason: 'changed_plans' })
      .expect(200);
    expect((await plansOf(app(), patient.login))[0]?.entitlements[0]).toMatchObject({
      unitsTotal: 1,
      unitsUsed: 1,
    });
    // Entitlement use never exceeds the purchase, and the ledger reconciles (Step 9 checks).
    expect((await book(2)).fees).toMatchObject({ discountPaise: 10_000 });
    expect(await timers.ledgerMismatches()).toBe(mismatchesBefore);
  });

  it('PK-04 a plan for the buyer and one family member refuses a third person and shows use per person', async () => {
    const nurse = await listedProvider(app(), 'nurse', 'nursing_vitals_check', {
      feePaise: 30_000,
    });
    const planId = await packagePlan(app(), 'nursing_vitals_check', 5, 100_000, 0, 1);
    const patient = await signedUp(app());
    const purchaseId = await buy(app(), patient.login, planId);
    const relative = async (fullName: string) =>
      (
        (
          await server()
            .post('/v1/me/linked-patients')
            .set(bearer(patient.login))
            .send({ fullName, birthYear: 1950, gender: 'female', relationship: 'parent' })
            .expect(201)
        ).body as { id: string }
      ).id;
    const mother = await relative('Synthetic Mother');
    const aunt = await relative('Synthetic Aunt');
    const bookFor = async (nth: number, status: number, recipientId?: string) => {
      const startsAt = await firstSlot(app(), nurse.accountId, nurse.listingId, nth * 4);
      return createBooking(app(), patient.login, {
        listingId: nurse.listingId,
        startsAt,
        purchaseId,
        ...(recipientId ? { recipientId } : {}),
      }).expect(status);
    };
    await bookFor(0, 201);
    await bookFor(1, 201, mother);
    await bookFor(2, 201, mother);
    const refused = await bookFor(3, 409, aunt);
    expect(refused.body).toMatchObject({ code: 'plan_person_limit' });
    const [plan] = (
      await server().get('/v1/me/plans?locale=en').set(bearer(patient.login)).expect(200)
    ).body as {
      familyMembers: number;
      people: { linkedPatientId: string | null; unitsUsed: number }[];
    }[];
    expect(plan?.familyMembers).toBe(1);
    expect(plan?.people).toEqual([
      { linkedPatientId: null, unitsUsed: 1 },
      { linkedPatientId: mother, unitsUsed: 2 },
    ]);
  });
});

describe('Cancelling a plan (PK-07)', () => {
  const { app, server } = useApp();

  it('PK-07 a plan with an upcoming booking cancels only after that booking; then the unused share comes back', async () => {
    const nurse = await listedProvider(app(), 'nurse', 'nursing_vitals_check', {
      feePaise: 30_000,
    });
    const planId = await packagePlan(app(), 'nursing_vitals_check', 4, 100_000);
    const patient = await signedUp(app());
    const purchaseId = await buy(app(), patient.login, planId);
    const booking = (
      await createBooking(app(), patient.login, {
        listingId: nurse.listingId,
        startsAt: await firstSlot(app(), nurse.accountId, nurse.listingId),
        purchaseId,
      }).expect(201)
    ).body as Booking;
    const cancelPlan = () =>
      server().post(`/v1/me/plans/${purchaseId}/cancel`).set(bearer(patient.login));
    expect((await cancelPlan().expect(409)).body).toMatchObject({
      code: 'plan_has_upcoming_bookings',
    });
    await server()
      .post(`/v1/bookings/${booking.id}/cancel`)
      .set(bearer(patient.login))
      .send({ reason: 'changed_plans' })
      .expect(200);
    expect((await plansOf(app(), patient.login))[0]?.refundIfCancelledPaise).toBe(100_000);
    await cancelPlan().expect(204);
    const [plan] = await plansOf(app(), patient.login);
    expect(plan).toMatchObject({ status: 'cancelled' });
    expect(gateway(app()).refunds.some((refund) => refund.amountPaise === 100_000)).toBe(true);
    await cancelPlan().expect(409);
  });
});
