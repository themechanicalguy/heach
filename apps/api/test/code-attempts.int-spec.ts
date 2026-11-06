import request from 'supertest';
import { adminSignIn, signedUp, useApp } from './account-helpers.js';
import { bearer } from './auth-helpers.js';
import { firstSlot, paidBooking } from './booking-helpers.js';
import { listedProvider, SYNTHETIC_PDF } from './provider-helpers.js';
import { UPLOAD_CONTENT_TYPE } from '../src/app.factory.js';

const WRONG_IN_PARALLEL = 20;

/** Six-digit codes allow five wrong tries however many requests arrive at once (SE-08). */
describe('Code attempt limits under parallel guessing (MV-09, HS-03, LB-06, SE-04)', () => {
  const { app, db, server } = useApp();

  it('MV-09 twenty parallel wrong codes use five attempts; the link then stays locked', async () => {
    const { login } = await signedUp(app());
    const record = (
      await server()
        .post('/v1/vault/records')
        .set(bearer(login))
        .set('Content-Type', UPLOAD_CONTENT_TYPE)
        .send(
          JSON.stringify({
            recordType: 'scan',
            recordDate: '2025-01-01',
            title: 'Synthetic scan',
            file: { contentType: 'application/pdf', contentBase64: SYNTHETIC_PDF },
          }),
        )
        .expect(201)
    ).body as { id: string };
    const link = (
      await server()
        .post('/v1/vault/links')
        .set(bearer(login))
        .send({ recordIds: [record.id], hours: 24 })
        .expect(201)
    ).body as { id: string; token: string; code: string };
    const open = (code: string) => server().post(`/v1/shared-records/${link.token}`).send({ code });
    const wrong = link.code === '000000' ? '111111' : '000000';
    await open(link.code).expect(200);
    await Promise.all(Array.from({ length: WRONG_IN_PARALLEL }, () => open(wrong)));
    const { rows } = await db().query<{ attempts: number }>(
      'SELECT attempts FROM app.external_share WHERE id = $1',
      [link.id],
    );
    expect(rows[0]?.attempts).toBe(5);
    await open(link.code).expect(403);
  });

  it('HS-03 twenty parallel wrong start codes lock the visit after five', async () => {
    const nurse = await listedProvider(app(), 'nurse', 'nursing_vitals_check');
    const patient = await signedUp(app());
    const booking = await paidBooking(app(), patient.login, {
      listingId: nurse.listingId,
      startsAt: await firstSlot(app(), nurse.accountId, nurse.listingId),
    });
    await server()
      .post(`/v1/provider/requests/${booking.id}/accept`)
      .set(bearer(nurse.login))
      .expect(204);
    await db().query(
      `UPDATE app.booking SET starts_at = now() + interval '5 minutes', ends_at = now() + interval '50 minutes' WHERE id = $1`,
      [booking.id],
    );
    const { code } = (
      await server().get(`/v1/bookings/${booking.id}/code`).set(bearer(patient.login)).expect(200)
    ).body as { code: string };
    const start = (value: string) =>
      server()
        .post(`/v1/provider/bookings/${booking.id}/start`)
        .set(bearer(nurse.login))
        .send({ code: value });
    const wrong = code === '000000' ? '111111' : '000000';
    await Promise.all(Array.from({ length: WRONG_IN_PARALLEL }, () => start(wrong)));
    const { rows } = await db().query<{ code_attempts: number }>(
      'SELECT code_attempts FROM app.visit WHERE booking_id = $1',
      [booking.id],
    );
    expect(rows[0]?.code_attempts).toBe(5);
    const locked = await start(code);
    expect(locked.body).toMatchObject({ code: 'code_locked' });
  });
});

describe('Code attempt limits for labs and admins (LB-06, SE-04)', () => {
  const { app, db, server } = useApp();

  it('LB-06 another lab cannot probe a booking’s collection code; the right lab’s tries are capped', async () => {
    const lab = await listedProvider(app(), 'lab', 'lab_cbc', { feePaise: 30_000 });
    const otherLab = await listedProvider(app(), 'lab', 'lab_cbc', { feePaise: 30_000 });
    const patient = await signedUp(app());
    const booking = await paidBooking(app(), patient.login, {
      listingId: lab.listingId,
      startsAt: await firstSlot(app(), lab.accountId, lab.listingId),
      collection: 'walk_in',
    });
    await server()
      .post(`/v1/provider/requests/${booking.id}/accept`)
      .set(bearer(lab.login))
      .expect(204);
    const collect = (login: typeof lab.login, code: string) =>
      server()
        .post(`/v1/provider/lab/orders/${booking.id}/collect`)
        .set(bearer(login))
        .send({ code });
    await collect(otherLab.login, '000000').expect(404);
    await Promise.all(
      Array.from({ length: WRONG_IN_PARALLEL }, () => collect(lab.login, '000000')),
    );
    const { rows } = await db().query<{ code_attempts: number }>(
      'SELECT code_attempts FROM app.visit WHERE booking_id = $1',
      [booking.id],
    );
    expect(rows[0]?.code_attempts).toBe(5);
  });

  it('SE-04 the sixth wrong admin re-verification code ends every session of that admin', async () => {
    const support = await adminSignIn(app(), 'support');
    const reverify = (code: string) =>
      request(app().getHttpServer())
        .post('/admin/v1/auth/reverify')
        .set(bearer(support))
        .send({ code });
    for (let attempt = 0; attempt < 5; attempt += 1) await reverify('000000').expect(401);
    const locked = await reverify('000000').expect(401);
    expect(locked.body).toMatchObject({ code: 'mfa_locked' });
    await server().get('/admin/v1/me').set(bearer(support)).expect(401);
  });
});
