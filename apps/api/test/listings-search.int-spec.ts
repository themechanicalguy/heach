import { SlotLocks } from '../src/availability/slot-locks.js';
import { adminSignIn, signedUp, useApp } from './account-helpers.js';
import { bearer } from './auth-helpers.js';
import { listedProvider, PILOT_PIN, submittedProvider } from './provider-helpers.js';

interface Result {
  providerId: string;
  listingId: string;
  name: string;
  feePaise: number;
  earliestSlot: string | null;
  itemName: string;
}

describe('Listings, service areas and availability (SL-02 to SL-07, AV-01, AV-03)', () => {
  const { app, server } = useApp();

  it('SL-03 an Approved nurse lists a catalogue procedure; others are refused', async () => {
    const nurse = await listedProvider(app(), 'nurse', 'nursing_wound_dressing', {
      feePaise: 45_000,
    });
    const view = await server().get('/v1/provider/listings').set(bearer(nurse.login)).expect(200);
    const body = view.body as {
      items: { code: string; listing: { feePaise: number } | null }[];
      pins: string[];
    };
    expect(body.items.map((item) => item.code)).toContain('nursing_injection');
    expect(
      body.items.find((item) => item.code === 'nursing_wound_dressing')?.listing?.feePaise,
    ).toBe(45_000);
    expect(body.pins).toEqual([PILOT_PIN]);
    const listing = {
      feePaise: 100,
      durationMinutes: 30,
      active: true,
      careSettings: [],
      homeCollection: true,
    };
    await server()
      .put('/v1/provider/listings/physio_assessment')
      .set(bearer(nurse.login))
      .send(listing)
      .expect(404);
  });

  it('SL-04 attendants list shifts only; clinical items are not theirs to list', async () => {
    const attendant = await listedProvider(app(), 'attendant', 'attendant_day_12h');
    const listing = {
      feePaise: 90_000,
      durationMinutes: 720,
      active: true,
      careSettings: ['home'],
      homeCollection: true,
    };
    await server()
      .put('/v1/provider/listings/nursing_injection')
      .set(bearer(attendant.login))
      .send(listing)
      .expect(404);
  });

  it('SE-02 a provider not yet Approved cannot list, set an area or open hours', async () => {
    const pending = await submittedProvider(app(), 'physiotherapist');
    const refused = await server()
      .get('/v1/provider/listings')
      .set(bearer(pending.login))
      .expect(403);
    expect(refused.body).toMatchObject({ code: 'provider_not_approved' });
    await server().get('/v1/provider/availability').set(bearer(pending.login)).expect(403);
  });

  it('SL-05 the service area accepts serviceable PIN codes only', async () => {
    const nurse = await listedProvider(app(), 'nurse', 'nursing_vitals_check');
    const refused = await server()
      .put('/v1/provider/service-area')
      .set(bearer(nurse.login))
      .send({ pins: ['110001'], travelSurchargePaise: 0 })
      .expect(400);
    expect(refused.body).toMatchObject({ code: 'pin_not_serviceable' });
  });

  it('AV-01 leave closes days; blocks are listed and removable; bad hours are refused', async () => {
    const physio = await listedProvider(app(), 'physiotherapist', 'physio_ortho_rehab');
    const start = new Date(Date.now() - 3_600_000);
    const end = new Date(Date.now() + 15 * 86_400_000);
    const block = await server()
      .post('/v1/provider/availability/blocks')
      .set(bearer(physio.login))
      .send({ start, end })
      .expect(201);
    const slots = await server()
      .get(`/v1/providers/${physio.accountId}/slots?listing=${physio.listingId}&days=7`)
      .expect(200);
    expect((slots.body as { slots: string[] }).slots).toEqual([]);
    await server()
      .delete(`/v1/provider/availability/blocks/${(block.body as { id: string }).id}`)
      .set(bearer(physio.login))
      .expect(204);
    const reopened = await server()
      .get(`/v1/providers/${physio.accountId}/slots?listing=${physio.listingId}&days=2`)
      .expect(200);
    expect((reopened.body as { slots: string[] }).slots.length).toBeGreaterThan(0);
    await server()
      .put('/v1/provider/availability')
      .set(bearer(physio.login))
      .send({ rules: [{ weekday: 1, startMinute: 600, endMinute: 500 }], bufferMinutes: 10 })
      .expect(400);
  });
});

describe('Search, profiles and slot holds (SD-02 to SD-05, PO-05, AV-02)', () => {
  const { app, server } = useApp();
  const search = async (query: string) =>
    (await server().get(`/v1/search?${query}`).expect(200)).body as Result[];

  it('SD-04 search finds Approved providers serving the PIN code only, in the reader language', async () => {
    const nurse = await listedProvider(app(), 'nurse', 'nursing_catheter_care');
    const found = await search(
      `service=nursing&pin=${PILOT_PIN}&item=nursing_catheter_care&locale=en`,
    );
    const mine = found.find((result) => result.providerId === nurse.accountId);
    expect(mine).toMatchObject({ itemName: 'Catheter care', feePaise: 60_000 });
    expect(mine?.earliestSlot).not.toBeNull();
    const elsewhere = await search('service=nursing&pin=753001&item=nursing_catheter_care');
    expect(elsewhere.some((result) => result.providerId === nurse.accountId)).toBe(false);
    const odia = await search(
      `service=nursing&pin=${PILOT_PIN}&item=nursing_catheter_care&locale=or`,
    );
    expect(odia.find((result) => result.providerId === nurse.accountId)?.itemName).toBe(
      'କ୍ୟାଥେଟର ଯତ୍ନ',
    );
  });

  it('SD-02 SD-03 text, language, gender and fee filters narrow the results', async () => {
    const physio = await listedProvider(app(), 'physiotherapist', 'physio_geriatric', {
      feePaise: 80_000,
    });
    const base = `service=physiotherapy&pin=${PILOT_PIN}`;
    const has = (results: Result[]) =>
      results.some((result) => result.providerId === physio.accountId);
    expect(has(await search(`${base}&q=geriatric`))).toBe(true);
    expect(has(await search(`${base}&q=बुज़ुर्गों`))).toBe(true);
    expect(has(await search(`${base}&q=cardiology`))).toBe(false);
    expect(has(await search(`${base}&maxFeePaise=50000`))).toBe(false);
    expect(has(await search(`${base}&q=geriatric&language=or`))).toBe(true);
    expect(has(await search(`${base}&q=geriatric&gender=male`))).toBe(false);
  });

  it('PO-05 a public profile shows Approved providers only, with the nurse registration number', async () => {
    const nurse = await listedProvider(app(), 'nurse', 'nursing_injection');
    const profile = await server().get(`/v1/providers/${nurse.accountId}?locale=en`).expect(200);
    expect(profile.body).toMatchObject({
      role: 'nurse',
      identityVerified: true,
      registrationNumber: 'SYN-12345',
      listings: [{ itemCode: 'nursing_injection', prescriptionRequired: true }],
    });
    const { login } = await signedUp(app());
    const pending = await submittedProvider(app(), 'nurse');
    await server().get(`/v1/providers/${pending.accountId}`).set(bearer(login)).expect(404);
  });
});

describe('Slot holds and catalogue administration (AV-02, AD-04, AD-08)', () => {
  const { app, server } = useApp();
  const search = async (query: string) =>
    (await server().get(`/v1/search?${query}`).expect(200)).body as Result[];

  it('AV-02 two patients cannot hold one slot; a hold hides the slot from others', async () => {
    const physio = await listedProvider(app(), 'physiotherapist', 'physio_neuro_rehab');
    const url = `/v1/providers/${physio.accountId}/slots?listing=${physio.listingId}&days=3`;
    const [slot] = ((await server().get(url).expect(200)).body as { slots: string[] }).slots;
    const locks = app().get(SlotLocks);
    const start = new Date(slot ?? '');
    const holds = await Promise.all([
      locks.acquire(physio.accountId, start, 'patient-a'),
      locks.acquire(physio.accountId, start, 'patient-b'),
    ]);
    expect(holds.filter(Boolean)).toHaveLength(1);
    const after = ((await server().get(url).expect(200)).body as { slots: string[] }).slots;
    expect(after).not.toContain(slot);
  });

  it('AD-04 AD-08 a super admin pauses a catalogue item and a PIN code; both leave search', async () => {
    const lab = await listedProvider(app(), 'lab', 'lab_urine_routine');
    const admin = await adminSignIn(app(), 'super_admin');
    const has = async (query: string) =>
      (await search(query)).some((result) => result.providerId === lab.accountId);
    const query = `service=lab&pin=${PILOT_PIN}&item=lab_urine_routine`;
    expect(await has(query)).toBe(true);
    await server()
      .put('/admin/v1/catalogue/lab_urine_routine')
      .set(bearer(admin))
      .send({ active: false })
      .expect(204);
    expect(await has(query)).toBe(false);
    await server()
      .put('/admin/v1/catalogue/lab_urine_routine')
      .set(bearer(admin))
      .send({ active: true })
      .expect(204);
    await server()
      .put(`/admin/v1/pins/${PILOT_PIN}`)
      .set(bearer(admin))
      .send({ serviceable: false })
      .expect(204);
    expect(await has(query)).toBe(false);
    await server()
      .put(`/admin/v1/pins/${PILOT_PIN}`)
      .set(bearer(admin))
      .send({ serviceable: true })
      .expect(204);
    const support = await adminSignIn(app(), 'support');
    await server()
      .put('/admin/v1/catalogue/lab_urine_routine')
      .set(bearer(support))
      .send({ active: false })
      .expect(403);
    const catalogue = await server().get('/v1/catalogue?service=lab&locale=hi').expect(200);
    expect((catalogue.body as { code: string }[]).map((item) => item.code)).toContain(
      'lab_urine_routine',
    );
  });
});
