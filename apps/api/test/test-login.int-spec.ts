import type { INestApplication } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { USERS } from './auth-helpers.js';
import { bootApp } from './boot-app.js';

const KEY = randomBytes(32).toString('hex');

const signIn = (app: INestApplication<App>, headers: Record<string, string>, body: object) =>
  request(app.getHttpServer()).post('/v1/auth/test-login').set(headers).send(body);

/**
 * Boots the app with a configured key, as on the dev host. APP_ENV stays `test`: dev refuses the
 * local key double, and a configured key is enforced the same way in every environment. The dev
 * host without a key is covered by the unit tests of testLoginPermitted.
 */
async function keyedApp(): Promise<INestApplication<App>> {
  return bootApp('production', { APP_ENV: 'test', TEST_LOGIN_KEY: KEY });
}

afterEach(() => {
  delete process.env.TEST_LOGIN_KEY;
});

describe('Test sign-in behind a configured key (SE-07.23)', () => {
  it('SE-07.23 without the key every request is 404, whatever it sends', async () => {
    const app = await keyedApp();
    try {
      const codes = await Promise.all([
        signIn(app, {}, { userId: USERS.patientA }),
        signIn(
          app,
          { 'X-Test-Login-Key': randomBytes(32).toString('hex') },
          { userId: USERS.admin },
        ),
        signIn(app, { 'X-Test-Login-Key': '' }, { userId: USERS.provider }),
        signIn(app, {}, { userId: 'not-a-uuid', extra: true }),
      ]);
      expect(codes.map((response) => response.status)).toEqual([404, 404, 404, 404]);
      for (const response of codes) {
        expect(response.headers['set-cookie']).toBeUndefined();
        expect(JSON.stringify(response.body)).not.toContain('accessToken');
      }
    } finally {
      await app.close();
    }
  });

  it('SE-07.23 the key added by the loopback-only entry signs a synthetic user in', async () => {
    const app = await keyedApp();
    try {
      const response = await signIn(app, { 'X-Test-Login-Key': KEY }, { userId: USERS.patientA });
      expect(response.status).toBe(200);
      const token = (response.body as { accessToken: string }).accessToken;
      await request(app.getHttpServer())
        .get('/v1/sample/notes')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    } finally {
      await app.close();
    }
  });

  it('SE-07.23 local and CI test runs keep signing synthetic users in without a key', async () => {
    delete process.env.TEST_LOGIN_KEY;
    const app = await bootApp('test', { APP_ENV: 'test' });
    try {
      expect((await signIn(app, {}, { userId: USERS.patientA })).status).toBe(200);
    } finally {
      await app.close();
    }
  });
});
