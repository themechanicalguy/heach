import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createApp } from '../src/app.factory.js';

async function bootApp(nodeEnv: string): Promise<INestApplication<App>> {
  process.env.NODE_ENV = nodeEnv;
  process.env.API_PORT = '3001';
  const app = await createApp();
  await app.init();
  return app as INestApplication<App>;
}

describe('API (integration)', () => {
  let app: INestApplication<App>;

  afterEach(async () => {
    await app.close();
  });

  it('GET /healthz returns status and version', async () => {
    app = await bootApp('test');

    const response = await request(app.getHttpServer()).get('/healthz').expect(200);

    expect(response.body).toEqual({ status: 'ok', version: 'dev' });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('unknown routes return the shared error shape', async () => {
    app = await bootApp('test');

    const response = await request(app.getHttpServer()).get('/nope').expect(404);

    expect(response.body).toMatchObject({ statusCode: 404, error: 'Not Found', path: '/nope' });
  });

  it('serves /docs outside production only', async () => {
    app = await bootApp('test');
    await request(app.getHttpServer()).get('/docs').expect(200);
    await app.close();

    app = await bootApp('production');
    await request(app.getHttpServer()).get('/docs').expect(404);
  });
});
