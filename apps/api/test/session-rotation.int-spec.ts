import type { INestApplication } from '@nestjs/common';
import type pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AccessTokenStore } from '../src/auth/access-token.store.js';
import { SessionRepository } from '../src/auth/session.repository.js';
import { bearer, fromResponse, login, type Login, USERS } from './auth-helpers.js';
import { bootApp } from './boot-app.js';
import { connectAs } from './db.js';

const REPEATS = 50;
// 50 repetitions run past the 5 s default on slower CI runners (SE-07.20 timed out on #70).
const REPEAT_TIMEOUT_MS = 30_000;

let app: INestApplication<App>;
let admin: pg.Client;

beforeAll(async () => {
  app = await bootApp();
  admin = await connectAs('admin');
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await admin.end();
  await app.close();
});

const refresh = (cookie: string) =>
  request(app.getHttpServer()).post('/v1/auth/refresh').set('Cookie', cookie);
const me = (token: string) =>
  request(app.getHttpServer())
    .get('/v1/sample/notes')
    .set(bearer({ token } as Login));
const logoutAll = (session: Login) =>
  request(app.getHttpServer())
    .post('/v1/auth/logout')
    .set(bearer(session))
    .send({ allDevices: true });

/** The refresh cookie set by a response, if any. */
const refreshCookie = (response: request.Response) =>
  ([] as string[])
    .concat(response.headers['set-cookie'] ?? [])
    .find((c) => c.startsWith('heach_refresh='));

async function sessionCount(userId: string): Promise<number> {
  const { rows } = await admin.query<{ n: string }>(
    'SELECT count(*) AS n FROM app.session WHERE user_id = $1',
    [userId],
  );
  return Number(rows[0]?.n);
}

/** Every access token and refresh cookie given is rejected with 401. */
async function expectNothingWorks(sessions: Login[]): Promise<void> {
  for (const session of sessions) {
    expect((await me(session.token)).status, 'access token').toBe(401);
    expect((await refresh(session.cookie)).status, 'refresh cookie').toBe(401);
  }
}

/** Sessions a race produced: the 200 responses' new token and cookie. */
const winners = (...responses: request.Response[]) =>
  responses.filter((r) => r.status === 200).map(fromResponse);

describe('Session rotation under faults (SE-07.14 to SE-07.17)', () => {
  it('SE-07.14 a failed session insert keeps the old session', async () => {
    const device = await login(app, USERS.patientA);
    const before = await sessionCount(USERS.patientA);
    vi.spyOn(app.get(SessionRepository), 'create').mockRejectedValueOnce(new Error('db down'));
    const failed = await refresh(device.cookie);
    expect(failed.status).toBe(500);
    expect(await sessionCount(USERS.patientA)).toBe(before);
    expect((await refresh(device.cookie)).status).toBe(200);
  });

  it('SE-07.15 a failed access-token issue leaves no usable token and keeps the old session', async () => {
    const device = await login(app, USERS.patientA);
    const before = await sessionCount(USERS.patientA);
    vi.spyOn(app.get(AccessTokenStore), 'issue').mockRejectedValueOnce(new Error('redis down'));
    const failed = await refresh(device.cookie);
    expect(failed.status).toBe(500);
    expect((failed.body as { accessToken?: string }).accessToken).toBeUndefined();
    expect(await sessionCount(USERS.patientA)).toBe(before);
    expect((await refresh(device.cookie)).status).toBe(200);
  });

  it('SE-07.16 only 401 clears the refresh cookie', async () => {
    const device = await login(app, USERS.patientA);
    vi.spyOn(app.get(SessionRepository), 'create').mockRejectedValueOnce(new Error('db down'));
    const serverError = await refresh(device.cookie);
    expect(serverError.status).toBe(500);
    expect(refreshCookie(serverError)).toBeUndefined();
    const rotated = await refresh(device.cookie);
    expect(rotated.status).toBe(200);
    expect(refreshCookie(rotated)).toMatch(/^heach_refresh=[^;]+;/);
    const unauthorised = await refresh('heach_refresh=not-a-real-token');
    expect(unauthorised.status).toBe(401);
    expect(refreshCookie(unauthorised)).toMatch(/^heach_refresh=;/);
  });

  it(
    'SE-07.17 the same cookie refreshes after a transient fault (50 users, SC-002)',
    async () => {
      const store = app.get(AccessTokenStore);
      for (let attempt = 0; attempt < REPEATS; attempt += 1) {
        const device = await login(app, USERS.patientB);
        vi.spyOn(store, 'issue').mockRejectedValueOnce(new Error('redis down'));
        expect((await refresh(device.cookie)).status).toBe(500);
        const recovered = await refresh(device.cookie);
        expect(recovered.status).toBe(200);
        await me(fromResponse(recovered).token).expect(200);
      }
    },
    REPEAT_TIMEOUT_MS,
  );
});

describe('Replay and sign-out under concurrency (SE-07.18 to SE-07.20)', () => {
  it(
    'SE-07.18 a concurrent replay revokes the winner too (50 races, SC-001)',
    async () => {
      for (let attempt = 0; attempt < REPEATS; attempt += 1) {
        const racer = await login(app, USERS.provider);
        const other = await login(app, USERS.provider);
        const [first, second] = await Promise.all([refresh(racer.cookie), refresh(racer.cookie)]);
        expect([first.status, second.status]).not.toEqual([200, 200]);
        await expectNothingWorks([racer, other, ...winners(first, second)]);
      }
    },
    REPEAT_TIMEOUT_MS,
  );

  it('SE-07.19 a sequential replay revokes every session', async () => {
    const device = await login(app, USERS.provider);
    const other = await login(app, USERS.provider);
    const rotated = fromResponse(await refresh(device.cookie).expect(200));
    const replay = await refresh(device.cookie);
    expect(replay.status).toBe(401);
    expect(refreshCookie(replay)).toMatch(/^heach_refresh=;/);
    await expectNothingWorks([device, other, rotated]);
  });

  it(
    'SE-07.20 sign-out of all devices during another device refresh leaves no session (50 times)',
    async () => {
      for (let attempt = 0; attempt < REPEATS; attempt += 1) {
        const leaving = await login(app, USERS.patientB);
        const other = await login(app, USERS.patientB);
        const [signOut, refreshed] = await Promise.all([logoutAll(leaving), refresh(other.cookie)]);
        expect(signOut.status).toBe(204);
        await expectNothingWorks([leaving, other, ...winners(refreshed)]);
      }
    },
    REPEAT_TIMEOUT_MS,
  );
});

const logoutDevice = (session: Login) =>
  request(app.getHttpServer())
    .post('/v1/auth/logout')
    .set(bearer(session))
    .send({ allDevices: false });

/** Another device of the same user still works: its access token and its refresh cookie. */
async function expectStillSignedIn(session: Login): Promise<void> {
  expect((await me(session.token)).status, 'other device access token').toBe(200);
  expect((await refresh(session.cookie)).status, 'other device refresh').toBe(200);
}

describe('Device sign-out revokes its whole session family (SE-07.21, SE-07.22)', () => {
  it('SE-07.21 login, refresh twice, logout: every earlier token of the device stops', async () => {
    const first = await login(app, USERS.patientA);
    const other = await login(app, USERS.patientA);
    const second = fromResponse(await refresh(first.cookie).expect(200));
    const third = fromResponse(await refresh(second.cookie).expect(200));
    // The pre-refresh access tokens are still valid until the device signs out.
    expect((await me(first.token)).status).toBe(200);
    expect((await logoutDevice(third)).status).toBe(204);
    await expectNothingWorks([first, second, third]);
    await expectStillSignedIn(other);
  });

  it('SE-07.21 logout with a pre-refresh access token also ends the newer tokens', async () => {
    const first = await login(app, USERS.patientA);
    const other = await login(app, USERS.patientA);
    const rotated = fromResponse(await refresh(first.cookie).expect(200));
    expect((await logoutDevice(first)).status).toBe(204);
    await expectNothingWorks([first, rotated]);
    await expectStillSignedIn(other);
  });

  it('SE-07.3 logout of all devices ends every family of the user', async () => {
    const first = await login(app, USERS.patientA);
    const other = await login(app, USERS.patientA);
    const rotated = fromResponse(await refresh(first.cookie).expect(200));
    expect((await logoutAll(rotated)).status).toBe(204);
    await expectNothingWorks([first, rotated, other]);
  });

  it('SE-07.22 reusing a signed-out device token is refused and leaves other devices', async () => {
    const device = await login(app, USERS.patientA);
    const other = await login(app, USERS.patientA);
    const rotated = fromResponse(await refresh(device.cookie).expect(200));
    expect((await logoutDevice(rotated)).status).toBe(204);
    const reuse = await refresh(device.cookie);
    expect(reuse.status).toBe(401);
    expect(refreshCookie(reuse)).toMatch(/^heach_refresh=;/);
    await expectStillSignedIn(other);
  });

  it('SE-07.19 a replay while the family is live still revokes every device', async () => {
    const device = await login(app, USERS.patientA);
    const other = await login(app, USERS.patientA);
    const rotated = fromResponse(await refresh(device.cookie).expect(200));
    expect((await refresh(device.cookie)).status).toBe(401);
    await expectNothingWorks([device, rotated, other]);
  });

  it(
    'SE-07.22 refresh racing a device logout ends the device and spares the others (50 races)',
    async () => {
      const other = await login(app, USERS.patientA);
      for (let attempt = 0; attempt < REPEATS; attempt += 1) {
        const device = await login(app, USERS.patientA);
        const [signOut, refreshed] = await Promise.all([
          logoutDevice(device),
          refresh(device.cookie),
        ]);
        expect(signOut.status).toBe(204);
        expect([200, 401]).toContain(refreshed.status);
        await expectNothingWorks([device, ...winners(refreshed)]);
        expect((await me(other.token)).status, 'other device after race').toBe(200);
      }
      expect((await refresh(other.cookie)).status).toBe(200);
    },
    REPEAT_TIMEOUT_MS,
  );
});
