import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { appLogger } from '../src/common/app-logger.js';
import { bootApp } from './boot-app.js';

const VITAL = { name: 'LCP', value: 1234.5, route: '/[locale]/notes', device: 'mobile' };

describe('Real-user monitoring endpoint (TS-03.1, LM-04.1)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await bootApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('LM-04.1 logs one vital with route template and device class only, no identity', async () => {
    const info = vi.spyOn(appLogger, 'info');
    await request(app.getHttpServer()).post('/v1/rum').send(VITAL).expect(204);
    const line = info.mock.calls.find((call) => call[1] === 'web-vital');
    expect(line?.[0]).toEqual({
      vital: 'LCP',
      value: 1234.5,
      route: '/[locale]/notes',
      device: 'mobile',
    });
  });

  it.each([
    ['an unknown vital', { ...VITAL, name: 'FID' }],
    ['a negative value', { ...VITAL, value: -1 }],
    ['a URL with a query string', { ...VITAL, route: '/en/notes?id=1' }],
    ['a full URL', { ...VITAL, route: 'https://example.test/en' }],
    ['an unknown device class', { ...VITAL, device: 'watch' }],
    ['an extra identity field', { ...VITAL, userId: '00000000-0000-4000-8000-000000000001' }],
  ])('TS-03.1 rejects %s with 400 and logs nothing', async (_case, body) => {
    const info = vi.spyOn(appLogger, 'info');
    await request(app.getHttpServer()).post('/v1/rum').send(body).expect(400);
    expect(info.mock.calls.some((call) => call[1] === 'web-vital')).toBe(false);
  });

  it('TS-03.1 needs no sign-in and sets no cookie', async () => {
    const response = await request(app.getHttpServer()).post('/v1/rum').send(VITAL).expect(204);
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
