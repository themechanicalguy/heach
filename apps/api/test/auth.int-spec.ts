import type { INestApplication } from '@nestjs/common';
import type { Redis } from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { hashToken } from '../src/auth/token-hash.js';
import { REDIS_CLIENT } from '../src/data-stores/data-stores.tokens.js';
import { bearer, fromResponse, login, type Login, USERS } from './auth-helpers.js';
import { bootApp } from './boot-app.js';

describe('Sessions (SE-07)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await bootApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const refresh = (cookie: string) =>
    request(app.getHttpServer()).post('/v1/auth/refresh').set('Cookie', cookie);
  const me = (token: string) =>
    request(app.getHttpServer()).get('/v1/sample/notes').set('Authorization', `Bearer ${token}`);

  it('SE-07.1 access tokens live at most 15 minutes', async () => {
    const session = await login(app, USERS.patientA);
    const ttl = await app.get<Redis>(REDIS_CLIENT).ttl(`at:${hashToken(session.token)}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(900);
  });

  it('SE-07.1 the refresh token sits in a Secure, HttpOnly, SameSite=Strict cookie and rotates', async () => {
    const first = await login(app, USERS.patientA);
    expect(first.setCookie).toMatch(/HttpOnly/);
    expect(first.setCookie).toMatch(/Secure/);
    expect(first.setCookie).toMatch(/SameSite=Strict/);
    const second = fromResponse(await refresh(first.cookie).expect(200));
    expect(second.cookie).not.toBe(first.cookie);
    await me(second.token).expect(200);
  });

  const statuses = (...tests: request.Test[]) =>
    Promise.all(tests.map(async (t) => (await t).status));
  const logout = (session: Login, allDevices: boolean) =>
    request(app.getHttpServer()).post('/v1/auth/logout').set(bearer(session)).send({ allDevices });

  it('SE-07.2 replaying a used refresh token revokes every session of that user', async () => {
    const deviceOne = await login(app, USERS.patientA);
    const deviceTwo = await login(app, USERS.patientA);
    const rotated = fromResponse(await refresh(deviceOne.cookie).expect(200));
    expect((await refresh(deviceOne.cookie)).status).toBe(401);
    expect(
      await statuses(
        me(rotated.token),
        me(deviceTwo.token),
        refresh(rotated.cookie),
        refresh(deviceTwo.cookie),
      ),
    ).toEqual([401, 401, 401, 401]);
  });

  it('SE-07.3 logging out of all devices stops every refresh token', async () => {
    const deviceOne = await login(app, USERS.patientB);
    const deviceTwo = await login(app, USERS.patientB);
    expect((await logout(deviceOne, true)).status).toBe(204);
    expect(
      await statuses(refresh(deviceOne.cookie), refresh(deviceTwo.cookie), me(deviceTwo.token)),
    ).toEqual([401, 401, 401]);
  });

  it('logs out one device only when asked', async () => {
    const deviceOne = await login(app, USERS.patientB);
    const deviceTwo = await login(app, USERS.patientB);
    expect((await logout(deviceOne, false)).status).toBe(204);
    expect(await statuses(me(deviceOne.token), me(deviceTwo.token))).toEqual([401, 200]);
  });

  it('SE-07.13 a concurrent second use of a refresh token revokes every session', async () => {
    const racer = await login(app, USERS.provider);
    const otherDevice = await login(app, USERS.provider);
    const [first, second] = await Promise.all([refresh(racer.cookie), refresh(racer.cookie)]);
    // At most one use succeeds; the other is the replay.
    expect([first.status, second.status]).toContain(401);
    expect([first.status, second.status]).not.toEqual([200, 200]);
    const loser = first.status === 401 ? first : second;
    expect((loser.body as { accessToken?: string }).accessToken).toBeUndefined();
    expect(String(loser.headers['set-cookie'])).toMatch(/heach_refresh=;/);
    // Sessions that existed before the reuse was detected all stop working. The winner's new
    // session is revoked too since spec 004; SE-07.18 in session-rotation.int-spec.ts proves it.
    expect(
      await statuses(me(racer.token), me(otherDevice.token), refresh(otherDevice.cookie)),
    ).toEqual([401, 401, 401]);
  });

  it('SE-07.10 logout after a refresh ends the rotated session', async () => {
    const device = await login(app, USERS.patientB);
    const rotated = fromResponse(await refresh(device.cookie).expect(200));
    const response = await logout(rotated, false);
    expect(response.status).toBe(204);
    expect(String(response.headers['set-cookie'])).toMatch(/heach_refresh=;/);
    expect(await statuses(refresh(rotated.cookie), me(rotated.token))).toEqual([401, 401]);
  });

  it('rejects unknown users and malformed sign-in requests', async () => {
    const signIn = (userId: string) =>
      request(app.getHttpServer()).post('/v1/auth/test-login').send({ userId });
    expect(await statuses(signIn('99999999-9999-4999-8999-999999999999'), signIn('nope'))).toEqual([
      404, 400,
    ]);
  });
});
