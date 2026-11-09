import { CoveragePinsCache } from '../src/search/coverage-pins.cache.js';
import { useApp } from './account-helpers.js';
import { bearer } from './auth-helpers.js';
import { listedProvider } from './provider-helpers.js';

interface Pin {
  pin: string;
  district: string;
  providers: number;
  band: string;
  nextAvailable: string | null;
}

describe('Serviceable PINs with availability (SD-04)', () => {
  const { app, server, db } = useApp();
  const pin = '759998';
  const pins = async () => server().get('/v1/coverage/pins?service=nursing').expect(200);
  const mine = (body: unknown) => (body as Pin[]).find((entry) => entry.pin === pin);

  beforeAll(async () => {
    await db().query(
      "INSERT INTO app.pin_code (pin, district, serviceable) VALUES ($1, 'Synthetic pins district', true)",
      [pin],
    );
    await app().get(CoveragePinsCache).invalidate();
  });
  afterAll(async () => {
    await db().query('DELETE FROM app.service_area WHERE pin = $1', [pin]);
    await db().query('DELETE FROM app.pin_code WHERE pin = $1', [pin]);
    await app().get(CoveragePinsCache).invalidate();
  });

  it('is public, cacheable, names no provider, and follows approvals and listing changes', async () => {
    const empty = await pins();
    expect(empty.headers['cache-control']).toContain('public');
    expect(empty.headers['cache-control']).toContain('s-maxage=300');
    expect(mine(empty.body)).toEqual({
      pin,
      district: 'Synthetic pins district',
      providers: 0,
      band: 'none',
      nextAvailable: null,
    });

    const nurse = await listedProvider(app(), 'nurse', 'nursing_vitals_check', { pins: [pin] });
    const served = await pins();
    expect(mine(served.body)).toMatchObject({ providers: 1, band: 'limited' });
    expect(JSON.stringify(served.body)).not.toContain(nurse.accountId);

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
    expect(mine((await pins()).body)).toMatchObject({ providers: 0, band: 'none' });
  });

  it('rejects an unknown service', async () => {
    await server().get('/v1/coverage/pins?service=dentistry').expect(400);
    await server().get('/v1/coverage/pins').expect(400);
  });
});
