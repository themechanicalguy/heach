import type { Readiness } from '@heach/types';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { bootApp } from './boot-app.js';

describe('GET /readyz (integration, needs PostgreSQL and Redis running)', () => {
  let app: INestApplication<App>;

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 when PostgreSQL and Redis answer', async () => {
    app = await bootApp();

    const response = await request(app.getHttpServer()).get('/readyz').expect(200);

    const expected: Readiness = { status: 'ok', checks: { postgres: 'ok', redis: 'ok' } };
    expect(response.body).toEqual(expected);
  });

  it('returns 503 naming the dependency that is down, with no connection details', async () => {
    const realUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://nobody:wrong@127.0.0.1:1/none';
    try {
      app = await bootApp();
    } finally {
      process.env.DATABASE_URL = realUrl;
    }

    const response = await request(app.getHttpServer()).get('/readyz').expect(503);

    expect(response.body).toEqual({ status: 'error', checks: { postgres: 'down', redis: 'ok' } });
    expect(JSON.stringify(response.body)).not.toMatch(/nobody|wrong|127\.0\.0\.1/);
  });
});
