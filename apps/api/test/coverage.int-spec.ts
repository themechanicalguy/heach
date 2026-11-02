import { useApp } from './account-helpers.js';
import { bearer } from './auth-helpers.js';
import { listedProvider, PILOT_PIN, submittedProvider } from './provider-helpers.js';

describe('Public coverage from published listings (SD-04)', () => {
  const { app, server } = useApp();
  it('answers publicly by POST, includes serving listings, and rejects invalid PINs', async () => {
    const nurse = await listedProvider(app(), 'nurse', 'nursing_vitals_check');
    const found = await server().post('/v1/coverage').send({ pin: PILOT_PIN }).expect(200);
    expect((found.body as { served: boolean }).served).toBe(true);
    expect((found.body as { services: string[] }).services).toContain('nursing');
    expect(found.headers['cache-control']).toBe('no-store');
    expect(
      (found.body as { services: string[] }).services.every((service) =>
        ['physiotherapy', 'nursing', 'attendant', 'lab'].includes(service),
      ),
    ).toBe(true);
    await server()
      .post('/v1/coverage')
      .send({ pin: '110001' })
      .expect(200)
      .expect({ served: false, services: [] });
    await server().post('/v1/coverage').send({ pin: 'invalid' }).expect(400);
    await server().get('/v1/coverage?pin=751001').expect(404);
    await server()
      .put('/v1/provider/listings/nursing_vitals_check')
      .set(bearer(nurse.login))
      .send({
        active: false,
        feePaise: 60000,
        durationMinutes: 45,
        careSettings: [],
        homeCollection: true,
      })
      .expect(200);
  });
});

describe('Coverage publication gates', () => {
  const { app, server, db } = useApp();
  const pin = '759999';
  beforeAll(async () => {
    await db().query(
      "INSERT INTO app.pin_code (pin, district, serviceable) VALUES ($1, 'Synthetic coverage district', true)",
      [pin],
    );
  });
  afterAll(async () => {
    /* Provider fixtures retain their service-area FK, so remove those first. */
    await db().query('DELETE FROM app.service_area WHERE pin = $1', [pin]);
    await db().query('DELETE FROM app.pin_code WHERE pin = $1', [pin]);
  });
  it('excludes inactive listings and unapproved or suspended providers', async () => {
    const nurse = await listedProvider(app(), 'nurse', 'nursing_vitals_check', { pins: [pin] });
    const result = () => server().post('/v1/coverage').send({ pin }).expect(200);
    expect((await result()).body).toEqual({ served: true, services: ['nursing'] });
    await db().query('UPDATE app.listing SET active = false WHERE id = $1', [nurse.listingId]);
    expect((await result()).body).toEqual({ served: false, services: [] });
    await db().query('UPDATE app.listing SET active = true WHERE id = $1', [nurse.listingId]);
    await db().query(
      "UPDATE app.role_assignment SET application_status = 'suspended' WHERE account_id = $1 AND side = 'provider'",
      [nurse.accountId],
    );
    expect((await result()).body).toEqual({ served: false, services: [] });
    const pending = await submittedProvider(app(), 'nurse');
    expect(pending.accountId).not.toBe(nurse.accountId);
  });
});

describe('Coverage public rate limiting (SO-08)', () => {
  const { server } = useApp({ RATE_LIMIT_PER_ADDRESS_PER_MINUTE: '2' });
  it('limits repeated unauthenticated coverage checks by address', async () => {
    await server().post('/v1/coverage').send({ pin: '110001' }).expect(200);
    await server().post('/v1/coverage').send({ pin: '110001' }).expect(200);
    const limited = await server().post('/v1/coverage').send({ pin: '110001' }).expect(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });
});
