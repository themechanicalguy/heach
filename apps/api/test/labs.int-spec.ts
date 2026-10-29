import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { UPLOAD_CONTENT_TYPE } from '../src/app.factory.js';
import {
  adminSignIn,
  CURRENT_CONSENTS,
  otpSignIn,
  reverify,
  signedUp,
  syntheticMobile,
  useApp,
} from './account-helpers.js';
import { bearer, type Login } from './auth-helpers.js';
import { bookingOf, firstSlot, paidBooking } from './booking-helpers.js';
import {
  accountIdOf,
  listedProvider,
  SYNTHETIC_PDF,
  uploadDocument,
  verifyIdentity,
} from './provider-helpers.js';

/** A lab with two listed tests and one approved collector who joined by invitation (O-1). */
async function labWithCollector(app: INestApplication<App>) {
  const server = () => request(app.getHttpServer());
  const lab = await listedProvider(app, 'lab', 'lab_cbc', { feePaise: 30_000 });
  const lipid = {
    feePaise: 50_000,
    durationMinutes: 15,
    active: true,
    careSettings: [],
    homeCollection: true,
  };
  const listings = await server()
    .put('/v1/provider/listings/lab_lipid_profile')
    .set(bearer(lab.login))
    .send(lipid)
    .expect(200);
  const lipidListing =
    (listings.body as { items: { code: string; listing: { id: string } | null }[] }).items.find(
      (item) => item.code === 'lab_lipid_profile',
    )?.listing?.id ?? '';
  await reverify(app, lab.mobile, lab.login);
  const mobile = syntheticMobile();
  await server()
    .post('/v1/organisation/invitations')
    .set(bearer(lab.login))
    .send({ mobile })
    .expect(204);
  const { login } = await otpSignIn(app, mobile);
  const [invitation] = (await server().get('/v1/me/invitations').set(bearer(login))).body as {
    id: string;
  }[];
  await server()
    .put('/v1/me/setup')
    .set(bearer(login))
    .send({
      invitationId: invitation?.id,
      fullName: 'Synthetic Collector',
      gender: 'male',
      adultDeclared: true,
    })
    .expect(204);
  const done = await server()
    .post('/v1/me/setup/complete')
    .set(bearer(login))
    .send({ consents: CURRENT_CONSENTS })
    .expect(200);
  const collector: Login = { ...login, token: (done.body as { accessToken: string }).accessToken };
  await uploadDocument(app, collector, 'qualification_certificate').expect(200);
  await uploadDocument(app, collector, 'police_verification', {
    reference: 'SYN-9',
    expiresOn: '2030-01-01',
  }).expect(200);
  await verifyIdentity(app, collector);
  await server().post('/v1/provider/application/submit').set(bearer(collector)).expect(200);
  const collectorId = await accountIdOf(app, collector);
  const verifier = await adminSignIn(app, 'verifier');
  await server().get(`/admin/v1/applications/${collectorId}`).set(bearer(verifier)).expect(200);
  await server()
    .post(`/admin/v1/applications/${collectorId}/decision`)
    .set(bearer(verifier))
    .send({ decision: 'approve' })
    .expect(204);
  return { lab, lipidListing, collector, collectorId };
}

type Server = () => ReturnType<typeof request>;

/** The patient's code, a wrong try, then the right one: returns the sample identifier. */
async function collectWithCode(
  server: Server,
  bookingId: string,
  patient: Login,
  collector: Login,
): Promise<string> {
  const booking = { id: bookingId };
  const { code } = (
    await server().get(`/v1/bookings/${booking.id}/lab/code`).set(bearer(patient)).expect(200)
  ).body as { code: string };
  await server()
    .post(`/v1/provider/collections/${booking.id}/collect`)
    .set(bearer(collector))
    .send({ code: code === '000000' ? '111111' : '000000' })
    .expect(400);
  const { sampleId } = (
    await server()
      .post(`/v1/provider/collections/${booking.id}/collect`)
      .set(bearer(collector))
      .send({ code })
      .expect(200)
  ).body as { sampleId: string };
  return sampleId;
}

/** The lab's dashboard and the admin's lab view after one corrected report (LB-11, AD-13). */
async function expectDashboards(
  app: INestApplication<App>,
  lab: { login: Login; accountId: string },
) {
  const server = () => request(app.getHttpServer());
  const dashboard = await server()
    .get('/v1/provider/lab/dashboard')
    .set(bearer(lab.login))
    .expect(200);
  expect(dashboard.body).toMatchObject({ pendingReports: 0, lateReports: 0 });
  const support = await adminSignIn(app, 'support');
  const labs = (await server().get('/admin/v1/labs').set(bearer(support)).expect(200)).body as {
    labId: string;
    corrections: number;
    orders: number;
  }[];
  expect(labs.find((row) => row.labId === lab.accountId)).toMatchObject({
    corrections: 1,
    orders: 1,
  });
}

const report = (sampleId: string, extra: object = {}) =>
  JSON.stringify({
    contentType: 'application/pdf',
    contentBase64: SYNTHETIC_PDF,
    sampleId,
    ...extra,
  });

describe('Lab tests with home collection (J7; LB-02 to LB-11, AD-13)', () => {
  const { app, server } = useApp();

  it('J7 a cart of two tests: collector, code, sample ID, received, report, correction', async () => {
    const { lab, lipidListing, collector, collectorId } = await labWithCollector(app());
    const patient = await signedUp(app());
    const booking = await paidBooking(app(), patient.login, {
      listingId: lab.listingId,
      extraListingIds: [lipidListing],
      collection: 'home',
      startsAt: await firstSlot(app(), lab.accountId, lab.listingId),
    });
    expect(booking.fees).toMatchObject({ feePaise: 80_000, totalPaise: 85_000 });
    await server()
      .post(`/v1/provider/requests/${booking.id}/accept`)
      .set(bearer(lab.login))
      .expect(204);
    const view = async () =>
      (
        await server()
          .get(`/v1/bookings/${booking.id}/lab?locale=en`)
          .set(bearer(patient.login))
          .expect(200)
      ).body as {
        stage: string;
        items: unknown[];
        collector: { name: string } | null;
        sampleId: string | null;
        reports: { version: number }[];
      };
    expect(await view()).toMatchObject({
      stage: 'booked',
      items: [
        expect.objectContaining({ itemCode: 'lab_cbc' }),
        expect.objectContaining({ itemCode: 'lab_lipid_profile' }),
      ],
    });

    await server()
      .post(`/v1/provider/lab/orders/${booking.id}/collector`)
      .set(bearer(lab.login))
      .send({ collectorId })
      .expect(204);
    expect((await view()).collector?.name).toBe('Synthetic Collector');
    const assigned = (
      await server().get('/v1/provider/collections').set(bearer(collector)).expect(200)
    ).body as { bookingId: string; address: string }[];
    expect(assigned.find((row) => row.bookingId === booking.id)?.address).toBe(
      '12 Synthetic Lane, Bhubaneswar',
    );

    const sampleId = await collectWithCode(server, booking.id, patient.login, collector);
    expect(sampleId).toMatch(/^HX-[0-9A-Z]{10}$/);
    expect((await view()).stage).toBe('sample_collected');

    const upload = (body: string) =>
      server()
        .post(`/v1/provider/lab/orders/${booking.id}/report`)
        .set(bearer(lab.login))
        .set('Content-Type', UPLOAD_CONTENT_TYPE)
        .send(body);
    expect((await upload(report(sampleId)).expect(409)).body).toMatchObject({
      code: 'no_report_now',
    });
    await server()
      .post(`/v1/provider/lab/orders/${booking.id}/received`)
      .set(bearer(lab.login))
      .expect(204);
    expect((await upload(report('HX-0000000000')).expect(400)).body).toMatchObject({
      code: 'sample_mismatch',
    });
    await upload(report(sampleId)).expect(204);
    expect((await bookingOf(app(), patient.login, booking.id)).status).toBe('completed');
    const file = await server()
      .get(`/v1/bookings/${booking.id}/lab/report`)
      .set(bearer(patient.login))
      .expect(200);
    expect(file.body).toMatchObject({ contentType: 'application/pdf' });
    const stranger = await signedUp(app());
    await server()
      .get(`/v1/bookings/${booking.id}/lab/report`)
      .set(bearer(stranger.login))
      .expect(404);

    expect((await upload(report(sampleId)).expect(400)).body).toMatchObject({
      code: 'correction_reason_required',
    });
    await upload(report(sampleId, { correctionReason: 'wrong_value' })).expect(204);
    expect((await view()).reports.map((version) => version.version)).toEqual([2, 1]);
    // Filed in the vault once; the correction replaced it (MV-02, LB-09).
    const filed = (
      await server().get('/v1/vault?type=lab_report').set(bearer(patient.login)).expect(200)
    ).body as { source: string; tags: string[] }[];
    expect(filed).toEqual([
      expect.objectContaining({
        source: 'lab',
        tags: ['Complete blood count (CBC)', 'Lipid profile'],
      }),
    ]);
    await expectDashboards(app(), lab);
  });
});

describe('Walk-in collection and re-collection (LB-02, LB-10)', () => {
  const { app, server } = useApp();

  it('LB-10 a walk-in sample taken at the lab can be re-collected with a new identifier', async () => {
    const lab = await listedProvider(app(), 'lab', 'lab_hba1c');
    const patient = await signedUp(app());
    const booking = await paidBooking(app(), patient.login, {
      listingId: lab.listingId,
      collection: 'walk_in',
      startsAt: await firstSlot(app(), lab.accountId, lab.listingId),
    });
    expect(booking.fees.travelPaise).toBe(0);
    await server()
      .post(`/v1/provider/requests/${booking.id}/accept`)
      .set(bearer(lab.login))
      .expect(204);
    const codeOf = async () =>
      (
        (
          await server()
            .get(`/v1/bookings/${booking.id}/lab/code`)
            .set(bearer(patient.login))
            .expect(200)
        ).body as { code: string }
      ).code;
    const code = await codeOf();
    const first = (
      await server()
        .post(`/v1/provider/lab/orders/${booking.id}/collect`)
        .set(bearer(lab.login))
        .send({ code })
        .expect(200)
    ).body as { sampleId: string };
    await server()
      .post(`/v1/provider/lab/orders/${booking.id}/recollect`)
      .set(bearer(lab.login))
      .send({ reason: 'insufficient_sample' })
      .expect(204);
    const after = (
      await server().get(`/v1/bookings/${booking.id}/lab`).set(bearer(patient.login)).expect(200)
    ).body as { stage: string; events: { reason: string | null }[] };
    expect(after.stage).toBe('booked');
    expect(after.events.some((event) => event.reason === 'insufficient_sample')).toBe(true);
    await server()
      .post(`/v1/provider/lab/orders/${booking.id}/collector`)
      .set(bearer(lab.login))
      .send({ collectorId: lab.accountId })
      .expect(400);
    // Re-collection starts again from the same code; the booking is already in progress.
    const second = (
      await server()
        .post(`/v1/provider/lab/orders/${booking.id}/collect`)
        .set(bearer(lab.login))
        .send({ code })
        .expect(200)
    ).body as { sampleId: string };
    expect(second.sampleId).not.toBe(first.sampleId);
    expect(first.sampleId).toMatch(/^HX-/);
  });
});
