import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { UPLOAD_CONTENT_TYPE } from '../src/app.factory.js';
import { Settings } from '../src/settings/settings.service.js';
import { adminSignIn, signedUp, useApp } from './account-helpers.js';
import { bearer, type Login } from './auth-helpers.js';
import { firstSlot, paidBooking } from './booking-helpers.js';
import { listedProvider, SYNTHETIC_PDF } from './provider-helpers.js';

interface VaultRecord {
  id: string;
  source: string;
  recordType: string;
  title: string;
  issuedBy: string | null;
  tags: string[];
  visitNotes: { advice: string } | null;
  hasFile: boolean;
}

async function completedVisit(app: INestApplication<App>, db: pg.Client) {
  const server = () => request(app.getHttpServer());
  const nurse = await listedProvider(app, 'nurse', 'nursing_wound_dressing');
  const patient = await signedUp(app);
  const booking = await paidBooking(app, patient.login, {
    listingId: nurse.listingId,
    startsAt: await firstSlot(app, nurse.accountId, nurse.listingId),
  });
  await server()
    .post(`/v1/provider/requests/${booking.id}/accept`)
    .set(bearer(nurse.login))
    .expect(204);
  await db.query(
    `UPDATE app.booking SET starts_at = now() + interval '5 minutes', ends_at = now() + interval '50 minutes' WHERE id = $1`,
    [booking.id],
  );
  const { code } = (
    await server().get(`/v1/bookings/${booking.id}/code`).set(bearer(patient.login)).expect(200)
  ).body as { code: string };
  await server()
    .post(`/v1/provider/bookings/${booking.id}/start`)
    .set(bearer(nurse.login))
    .send({ code })
    .expect(204);
  return { nurse, patient, booking };
}

const upload = (app: INestApplication<App>, login: Login, body: object) =>
  request(app.getHttpServer())
    .post('/v1/vault/records')
    .set(bearer(login))
    .set('Content-Type', UPLOAD_CONTENT_TYPE)
    .send(JSON.stringify(body));

const OLD_SCAN = {
  recordType: 'scan',
  recordDate: '2025-06-01',
  title: 'Synthetic knee scan',
  facility: 'Synthetic Imaging',
  tags: ['knee'],
  file: { contentType: 'application/pdf', contentBase64: SYNTHETIC_PDF },
};

describe('The vault: filing, uploads and history (J9; MV-01 to MV-06, MV-12, MV-15)', () => {
  const { app, db, server } = useApp();
  const vault = async (login: Login, query = '') =>
    (await server().get(`/v1/vault${query}`).set(bearer(login)).expect(200)).body as VaultRecord[];

  it('MV-02 visit notes are filed automatically as a record issued by the nurse', async () => {
    const { nurse, patient, booking } = await completedVisit(app(), db());
    await server()
      .post(`/v1/provider/bookings/${booking.id}/complete`)
      .set(bearer(nurse.login))
      .send({ procedure: 'Dressing', observations: 'Healing', advice: 'Rest' })
      .expect(204);
    const [record] = await vault(patient.login);
    expect(record).toMatchObject({
      source: 'visit',
      recordType: 'visit_note',
      title: 'Wound cleaning and dressing',
      visitNotes: { advice: 'Rest' },
    });
    expect(record?.issuedBy).toBeTruthy();
    expect(
      (
        await server()
          .delete(`/v1/vault/records/${record?.id ?? ''}`)
          .set(bearer(patient.login))
          .expect(403)
      ).body,
    ).toMatchObject({ code: 'record_not_deletable' });
  });

  it('MV-03 MV-04 MV-06 uploads with person, type and tags; filters and search; delete own uploads', async () => {
    const { login } = await signedUp(app());
    const person = (
      await server()
        .post('/v1/me/linked-patients')
        .set(bearer(login))
        .send({
          fullName: 'Synthetic Child',
          birthYear: 2016,
          gender: 'male',
          relationship: 'child',
        })
        .expect(201)
    ).body as { id: string };
    const scan = (await upload(app(), login, OLD_SCAN).expect(201)).body as VaultRecord;
    expect(scan).toMatchObject({ source: 'patient', hasFile: true, tags: ['knee'] });
    await upload(app(), login, {
      personId: person.id,
      recordType: 'vaccination',
      recordDate: '2024-01-10',
      title: 'Synthetic vaccination card',
    }).expect(201);
    expect(await vault(login, '?type=scan')).toHaveLength(1);
    expect((await vault(login, `?person=${person.id}`)).map((row) => row.title)).toEqual([
      'Synthetic vaccination card',
    ]);
    expect((await vault(login, '?person=self')).map((row) => row.title)).toEqual([
      'Synthetic knee scan',
    ]);
    expect((await vault(login, '?q=imaging')).map((row) => row.id)).toEqual([scan.id]);
    expect((await vault(login, '?from=2025-01-01')).map((row) => row.id)).toEqual([scan.id]);
    const file = await server()
      .get(`/v1/vault/records/${scan.id}/file`)
      .set(bearer(login))
      .expect(200);
    expect(file.body).toMatchObject({ contentType: 'application/pdf' });
    const stored = await db().query<{ details: string }>(
      'SELECT details::text FROM app.vault_record WHERE id = $1',
      [scan.id],
    );
    expect(stored.rows[0]?.details).not.toContain('knee');
    const usage = (await server().get('/v1/vault/usage').set(bearer(login)).expect(200)).body as {
      usedBytes: number;
      nearlyFull: boolean;
    };
    expect(usage.usedBytes).toBeGreaterThan(0);
    await server().delete(`/v1/vault/records/${scan.id}`).set(bearer(login)).expect(204);
    expect(await vault(login, '?type=scan')).toHaveLength(0);
    const exported = (await server().get('/v1/vault/export').set(bearer(login)).expect(200))
      .body as { records: unknown[] };
    expect(exported.records).toHaveLength(1);
  });
});

describe('The vault: history and quota (MV-05, MV-15)', () => {
  const { app, server } = useApp();

  it('MV-05 history entries are attributed and removable by who added them', async () => {
    const { login } = await signedUp(app());
    await server()
      .post('/v1/vault/history')
      .set(bearer(login))
      .send({ kind: 'allergy', text: 'Synthetic penicillin allergy' })
      .expect(204);
    const history = (await server().get('/v1/vault/history').set(bearer(login)).expect(200))
      .body as { id: string; text: string; addedByRole: string }[];
    expect(history).toEqual([
      expect.objectContaining({ text: 'Synthetic penicillin allergy', addedByRole: 'patient' }),
    ]);
    await server()
      .delete(`/v1/vault/history/${history[0]?.id ?? ''}`)
      .set(bearer(login))
      .expect(204);
  });

  it('MV-15 an upload past the quota is refused', async () => {
    const settings = app().get(Settings);
    await settings.set('vault_quota_mb', 0);
    const { login } = await signedUp(app());
    let refused: request.Response;
    try {
      refused = await upload(app(), login, OLD_SCAN);
    } finally {
      await settings.set('vault_quota_mb', 200);
    }
    expect(refused.status).toBe(413);
    expect(refused.body).toMatchObject({ code: 'vault_quota' });
  });
});

describe('Sharing (MV-07 to MV-10, MV-14, AD-15)', () => {
  const { app, db, server } = useApp();

  it('MV-07 MV-08 MV-10 a booking share shows only the chosen records; reads are logged; revoke ends it', async () => {
    const { nurse, patient, booking } = await completedVisit(app(), db());
    const shared = (await upload(app(), patient.login, OLD_SCAN).expect(201)).body as VaultRecord;
    const privateRecord = (
      await upload(app(), patient.login, {
        recordType: 'other',
        recordDate: '2025-02-02',
        title: 'Synthetic private note',
      }).expect(201)
    ).body as VaultRecord;
    await server()
      .post('/v1/vault/history')
      .set(bearer(patient.login))
      .send({ kind: 'condition', text: 'Synthetic diabetes' })
      .expect(204);
    const share = (
      await server()
        .post('/v1/vault/shares')
        .set(bearer(patient.login))
        .send({ bookingId: booking.id, recordIds: [shared.id], includeHistory: true })
        .expect(201)
    ).body as { id: string };
    const panel = (
      await server()
        .get(`/v1/provider/bookings/${booking.id}/shared`)
        .set(bearer(nurse.login))
        .expect(200)
    ).body as { records: VaultRecord[]; history: { text: string }[] };
    expect(panel.records.map((row) => row.id)).toEqual([shared.id]);
    expect(JSON.stringify(panel)).not.toContain(privateRecord.title);
    expect(panel.history.map((entry) => entry.text)).toEqual(['Synthetic diabetes']);
    await server()
      .get(`/v1/provider/bookings/${booking.id}/shared/${shared.id}/file`)
      .set(bearer(nurse.login))
      .expect(200);
    await server()
      .get(`/v1/provider/bookings/${booking.id}/shared/${privateRecord.id}/file`)
      .set(bearer(nurse.login))
      .expect(404);
    const other = await listedProvider(app(), 'nurse', 'nursing_vitals_check');
    expect(
      (
        (
          await server()
            .get(`/v1/provider/bookings/${booking.id}/shared`)
            .set(bearer(other.login))
            .expect(200)
        ).body as { records: unknown[] }
      ).records,
    ).toEqual([]);
    const access = (
      await server()
        .get(`/v1/vault/records/${shared.id}/access`)
        .set(bearer(patient.login))
        .expect(200)
    ).body as { accessorRole: string; via: string }[];
    expect(access[0]).toMatchObject({ accessorRole: 'nurse', via: 'booking_share' });
    await server()
      .post(`/v1/vault/shares/${share.id}/revoke`)
      .set(bearer(patient.login))
      .expect(204);
    expect(
      (
        (
          await server()
            .get(`/v1/provider/bookings/${booking.id}/shared`)
            .set(bearer(nurse.login))
            .expect(200)
        ).body as { records: unknown[] }
      ).records,
    ).toEqual([]);
    await server()
      .post('/v1/vault/shares')
      .set(bearer(patient.login))
      .send({
        bookingId: booking.id,
        recordIds: ['00000000-0000-4000-8000-000000000099'],
        includeHistory: false,
      })
      .expect(404);
  });
});

describe('Records added by providers (MV-14)', () => {
  const { app, db, server } = useApp();

  it('MV-14 a provider adds a record within the booking, attributed to them', async () => {
    const { nurse, patient, booking } = await completedVisit(app(), db());
    await server()
      .post(`/v1/provider/bookings/${booking.id}/records`)
      .set(bearer(nurse.login))
      .send({ recordType: 'other', title: 'Synthetic dressing chart' })
      .expect(204);
    const records = (await server().get('/v1/vault').set(bearer(patient.login)).expect(200))
      .body as VaultRecord[];
    expect(records.find((row) => row.title === 'Synthetic dressing chart')).toMatchObject({
      source: 'provider',
    });
    const stranger = await listedProvider(app(), 'nurse', 'nursing_vitals_check');
    await server()
      .post(`/v1/provider/bookings/${booking.id}/records`)
      .set(bearer(stranger.login))
      .send({ recordType: 'other', title: 'x' })
      .expect(404);
  });
});

describe('External links and admin counts (MV-09, AD-15)', () => {
  const { app, db, server } = useApp();

  it('MV-09 an external link needs its code, can be revoked, and its reads are listed', async () => {
    const { login } = await signedUp(app());
    const record = (await upload(app(), login, OLD_SCAN).expect(201)).body as VaultRecord;
    const link = (
      await server()
        .post('/v1/vault/links')
        .set(bearer(login))
        .send({ recordIds: [record.id], hours: 24 })
        .expect(201)
    ).body as { id: string; token: string; code: string };
    const open = (code: string) => server().post(`/v1/shared-records/${link.token}`).send({ code });
    await open(link.code === '000000' ? '111111' : '000000').expect(400);
    const opened = (await open(link.code).expect(200)).body as {
      records: VaultRecord[];
      files: { contentType: string }[];
    };
    expect(opened.records.map((row) => row.id)).toEqual([record.id]);
    expect(opened.files[0]?.contentType).toBe('application/pdf');
    const access = (
      await server().get(`/v1/vault/records/${record.id}/access`).set(bearer(login)).expect(200)
    ).body as { via: string }[];
    expect(access[0]?.via).toBe('external_link');
    await server().post(`/v1/vault/links/${link.id}/revoke`).set(bearer(login)).expect(204);
    await open(link.code).expect(404);
    const stored = await db().query<{ token_hash: string }>(
      'SELECT token_hash FROM app.external_share WHERE id = $1',
      [link.id],
    );
    expect(stored.rows[0]?.token_hash).not.toBe(link.token);
  });

  it('AD-15 admins see vault counts, never content', async () => {
    const support = await adminSignIn(app(), 'support');
    const stats = (await server().get('/admin/v1/vault/stats').set(bearer(support)).expect(200))
      .body as Record<string, number>;
    expect(stats.records).toBeGreaterThan(0);
    expect(Object.keys(stats).sort((a, b) => a.localeCompare(b))).toEqual([
      'activeLinks',
      'activeShares',
      'infectedUploads',
      'openDeletionRequests',
      'records',
      'storageBytes',
    ]);
    const finance = await adminSignIn(app(), 'finance');
    await server().get('/admin/v1/vault/stats').set(bearer(finance)).expect(403);
  });
});
