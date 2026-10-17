import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { bearer, login, type Login, USERS } from './auth-helpers.js';
import { bootApp } from './boot-app.js';

type Caller = 'anonymous' | 'owner' | 'otherPatient' | 'provider' | 'admin';

/** The authorisation matrix from the Step 2 spec (SE-02.2). */
const MATRIX: {
  route: string;
  call: (s: request.Agent | ReturnType<typeof request>, noteId: string) => request.Test;
  expect: Record<Caller, number>;
}[] = [
  {
    route: 'POST /sample/notes',
    call: (s) => s.post('/v1/sample/notes').send({ body: 'synthetic' }),
    expect: { anonymous: 401, owner: 201, otherPatient: 201, provider: 403, admin: 403 },
  },
  {
    route: 'GET /sample/notes',
    call: (s) => s.get('/v1/sample/notes'),
    expect: { anonymous: 401, owner: 200, otherPatient: 200, provider: 403, admin: 403 },
  },
  {
    route: 'GET /sample/notes/:id',
    call: (s, id) => s.get(`/v1/sample/notes/${id}`),
    expect: { anonymous: 401, owner: 200, otherPatient: 404, provider: 403, admin: 403 },
  },
  {
    route: 'POST /auth/logout',
    call: (s) => s.post('/v1/auth/logout').send({ allDevices: false }),
    expect: { anonymous: 401, owner: 204, otherPatient: 204, provider: 204, admin: 204 },
  },
  {
    route: 'POST /auth/refresh',
    call: (s) => s.post('/v1/auth/refresh'),
    expect: { anonymous: 401, owner: 401, otherPatient: 401, provider: 401, admin: 401 },
  },
];

describe('Authorisation harness (SE-02.2, TS-09)', () => {
  let app: INestApplication<App>;
  let noteId: string;

  beforeAll(async () => {
    app = await bootApp();
    const owner = await login(app, USERS.patientA);
    const created = await request(app.getHttpServer())
      .post('/v1/sample/notes')
      .set(bearer(owner))
      .send({ body: 'synthetic' });
    noteId = (created.body as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
  });

  const callerIds: Record<Exclude<Caller, 'anonymous'>, string> = {
    owner: USERS.patientA,
    otherPatient: USERS.patientB,
    provider: USERS.provider,
    admin: USERS.admin,
  };

  for (const row of MATRIX) {
    for (const caller of Object.keys(row.expect) as Caller[]) {
      it(`SE-02.2 ${row.route} as ${caller} returns ${String(row.expect[caller])}`, async () => {
        // A fresh session per call: logout must not affect other rows.
        const session: Login | undefined =
          caller === 'anonymous' ? undefined : await login(app, callerIds[caller]);
        const test = row.call(request(app.getHttpServer()), noteId);
        if (session) {
          void test.set(bearer(session));
        }
        expect((await test).status).toBe(row.expect[caller]);
      });
    }
  }
});
