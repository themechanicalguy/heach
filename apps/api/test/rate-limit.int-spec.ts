import type { INestApplication } from '@nestjs/common';
import { getStorageToken, type ThrottlerStorageService } from '@nestjs/throttler';
import { randomBytes } from 'node:crypto';
import type { Redis } from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { vi } from 'vitest';
import { AccessTokenStore } from '../src/auth/access-token.store.js';
import { hashToken } from '../src/auth/token-hash.js';
import { appLogger } from '../src/common/app-logger.js';
import { REDIS_CLIENT } from '../src/data-stores/data-stores.tokens.js';
import { bearer, fromResponse, USERS, type Login } from './auth-helpers.js';
import { bootApp } from './boot-app.js';

const LIMIT = 5;
// Above three users' allowances together, so the address limit is reached first (SO-08.12).
const ADDRESS_LIMIT = 12;
const PUBLIC_ROUTE = '/v1/auth/refresh';
const PROTECTED_ROUTE = '/v1/sample/notes';

const randomToken = () => randomBytes(24).toString('base64url');
// A different "client address" for every case, so one case never uses up another's allowance.
const randomAddress = () => `10.${Array.from(randomBytes(3)).join('.')}`;

/** An item of a list the test built itself; a missing one is a test bug, not a value. */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`no item at ${String(index)}`);
  }
  return item;
}

interface Caller {
  address: string;
  headers?: Record<string, string>;
}

/** One request to `route`; `address` is what the proxy would have appended to X-Forwarded-For. */
function hit(app: INestApplication<App>, route: string, caller: Caller) {
  const server = request(app.getHttpServer());
  const call = route === PUBLIC_ROUTE ? server.post(route) : server.get(route);
  return call.set({ 'X-Forwarded-For': caller.address, ...caller.headers });
}

async function statuses(
  app: INestApplication<App>,
  route: string,
  count: number,
  next: (i: number) => Caller,
): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push((await hit(app, route, next(i))).status);
  }
  return out;
}

/** Sign in from an address of its own, so setup never uses the allowance under test (F3). */
async function signIn(app: INestApplication<App>, userId: string): Promise<Login> {
  const response = await request(app.getHttpServer())
    .post('/v1/auth/test-login')
    .set('X-Forwarded-For', randomAddress())
    .send({ userId })
    .expect(200);
  return fromResponse(response);
}

/** Everything the API logs through its logger while capturing (arguments, as JSON text). */
function captureLogLines(): { text: () => string; stop: () => void } {
  const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
  const spies = levels.map((level) => vi.spyOn(appLogger, level));
  const collect = () =>
    spies.flatMap((spy) => spy.mock.calls.map((args) => JSON.stringify(args))).join('\n');
  let snapshot: string | undefined;
  return {
    text: () => snapshot ?? collect(),
    stop: () => {
      snapshot = collect();
      spies.forEach((spy) => {
        spy.mockRestore();
      });
    },
  };
}

const bearerOf = (token: string) => ({ Authorization: `Bearer ${token}` });
const count429 = (codes: number[]) => codes.filter((code) => code === 429).length;
const storageOf = (app: INestApplication<App>) =>
  app.get<ThrottlerStorageService>(getStorageToken());

/** Requests after the Nth are refused, the first N are not (a limit of N per window). */
function expectLimitedAfterLimit(codes: number[], limit = ADDRESS_LIMIT): void {
  expect(codes.slice(limit).every((code) => code === 429)).toBe(true);
  expect(codes.slice(0, limit).every((code) => code !== 429)).toBe(true);
}

/**
 * A fresh app per case gives each case empty counters: the synthetic users are shared, and their
 * allowance is per user, so cases must not use up each other's.
 */
function useFreshApp(): () => INestApplication<App> {
  let app: INestApplication<App>;
  beforeEach(async () => {
    app = await bootApp('test', {
      RATE_LIMIT_PER_MINUTE: String(LIMIT),
      RATE_LIMIT_PER_ADDRESS_PER_MINUTE: String(ADDRESS_LIMIT),
      RATE_LIMIT_WINDOW_SECONDS: '60',
    });
  });
  afterEach(async () => {
    await app.close();
  });
  return () => app;
}

describe('Rate limit counts unknown tokens by address (SO-08.4, SO-08.5, SO-08.8)', () => {
  const current = useFreshApp();

  describe.each([PUBLIC_ROUTE, PROTECTED_ROUTE])('on %s', (route) => {
    it('SO-08.4 SC-001 random bearer tokens are counted by address', async () => {
      const app = current();
      const address = randomAddress();
      const codes = await statuses(app, route, 5 * ADDRESS_LIMIT, () => ({
        address,
        headers: bearerOf(randomToken()),
      }));
      expect(count429(codes)).toBe(4 * ADDRESS_LIMIT);
      expectLimitedAfterLimit(codes);
    });

    it('SO-08.4 expired bearer tokens are counted by address', async () => {
      const app = current();
      const sessions = await Promise.all(
        Array.from({ length: ADDRESS_LIMIT + 3 }, () => signIn(app, USERS.patientA)),
      );
      await app.get<Redis>(REDIS_CLIENT).del(...sessions.map((s) => `at:${hashToken(s.token)}`));
      const address = randomAddress();
      const codes = await statuses(app, route, sessions.length, (i) => ({
        address,
        headers: bearer(at(sessions, i)),
      }));
      expectLimitedAfterLimit(codes);
    });

    it('SO-08.4 revoked bearer tokens are counted by address', async () => {
      const app = current();
      const sessions = await Promise.all(
        Array.from({ length: ADDRESS_LIMIT + 3 }, () => signIn(app, USERS.patientA)),
      );
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('X-Forwarded-For', randomAddress())
        .set(bearer(at(sessions, 0)))
        .send({ allDevices: false })
        .expect(204);
      // The revocation the logout performs, without ten signed-in calls from one user.
      const store = app.get(AccessTokenStore);
      await Promise.all(sessions.slice(1).map((session) => store.revoke(session.token)));
      const address = randomAddress();
      const codes = await statuses(app, route, sessions.length, (i) => ({
        address,
        headers: bearer(at(sessions, i)),
      }));
      expectLimitedAfterLimit(codes);
    });
  });

  it('SO-08.5 malformed Authorization headers are counted by address', async () => {
    const app = current();
    const headers = [
      `Basic ${randomToken()}`,
      `Bearer ${randomToken().slice(0, 19)}`,
      `Bearer ${'!'.repeat(30)}`,
      '',
    ];
    for (const route of [PUBLIC_ROUTE, PROTECTED_ROUTE]) {
      const address = randomAddress();
      const codes = await statuses(app, route, ADDRESS_LIMIT + 3, (i) => ({
        address,
        headers: { Authorization: at(headers, i % headers.length) },
      }));
      expectLimitedAfterLimit(codes);
    }
  });

  it('SO-08.8 storage size does not grow with fake tokens (SC-002)', async () => {
    const app = current();
    const address = randomAddress();
    const fake = () => ({ address, headers: bearerOf(randomToken()) });
    await statuses(app, PUBLIC_ROUTE, 10, fake);
    const afterTen = storageOf(app).storage.size;
    await statuses(app, PUBLIC_ROUTE, 1000, fake);
    expect(storageOf(app).storage.size).toBe(afterTen);
  });
});

describe('Rate limit counts a live session by user (SO-08.6, SO-08.7)', () => {
  const current = useFreshApp();

  it("SO-08.6 one user's tokens share one allowance", async () => {
    const app = current();
    const sessions = [await signIn(app, USERS.patientA), await signIn(app, USERS.patientA)];
    const address = randomAddress();
    const codes = await statuses(app, PROTECTED_ROUTE, 2 * LIMIT + 2, (i) => ({
      address,
      headers: bearer(at(sessions, i % 2)),
    }));
    expect(codes.slice(0, LIMIT)).toEqual(Array(LIMIT).fill(200));
    expect(codes.slice(LIMIT).every((code) => code === 429)).toBe(true);
  });

  describe('SO-08.7 users and anonymous traffic under the address limit do not limit each other', () => {
    it('SO-08.7 a limited user does not limit another user or anonymous callers', async () => {
      const app = current();
      const [a, b] = [await signIn(app, USERS.patientA), await signIn(app, USERS.patientB)];
      const address = randomAddress();
      const first = await statuses(app, PROTECTED_ROUTE, LIMIT + 2, () => ({
        address,
        headers: bearer(a),
      }));
      expect(first.at(-1)).toBe(429);
      expect((await hit(app, PROTECTED_ROUTE, { address, headers: bearer(b) })).status).toBe(200);
      expect((await hit(app, PROTECTED_ROUTE, { address })).status).toBe(401);
    });

    it('SO-08.7 anonymous traffic under the address limit uses no user allowance (SC-003)', async () => {
      const app = current();
      const a = await signIn(app, USERS.patientA);
      const address = randomAddress();
      await statuses(app, PROTECTED_ROUTE, LIMIT, () => ({ address }));
      const signedIn = await statuses(app, PROTECTED_ROUTE, LIMIT, () => ({
        address,
        headers: bearer(a),
      }));
      expect(signedIn).toEqual(Array(LIMIT).fill(200));
    });
  });
});

describe('Rate limit counts every request by address as well (SO-08.12)', () => {
  const current = useFreshApp();

  it('SO-08.12 valid tokens of several users do not lift the address limit', async () => {
    const app = current();
    const users = [USERS.patientA, USERS.patientB, USERS.provider];
    const sessions = await Promise.all(users.map((user) => signIn(app, user)));
    const address = randomAddress();
    const codes = await statuses(app, PROTECTED_ROUTE, users.length * LIMIT, (i) => ({
      address,
      headers: bearer(at(sessions, i % sessions.length)),
    }));
    expectLimitedAfterLimit(codes);
  });

  it('SO-08.12 an address over its limit is refused even with a valid token', async () => {
    const app = current();
    const a = await signIn(app, USERS.patientA);
    const address = randomAddress();
    await statuses(app, PROTECTED_ROUTE, ADDRESS_LIMIT, () => ({
      address,
      headers: bearerOf(randomToken()),
    }));
    expect((await hit(app, PROTECTED_ROUTE, { address, headers: bearer(a) })).status).toBe(429);
    // The same user from another address still has their allowance.
    const elsewhere = await hit(app, PROTECTED_ROUTE, {
      address: randomAddress(),
      headers: bearer(a),
    });
    expect(elsewhere.status).toBe(200);
  });

  it('SO-08.12 changing invalid tokens on the sign-in route share the address limit', async () => {
    const app = current();
    const address = randomAddress();
    const codes: number[] = [];
    for (let i = 0; i < ADDRESS_LIMIT + 3; i += 1) {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/test-login')
        .set({ 'X-Forwarded-For': address, ...bearerOf(randomToken()) })
        .send({ userId: USERS.patientA });
      codes.push(response.status);
    }
    expectLimitedAfterLimit(codes);
  });
});

describe('Rate limit uses the proxy-appended address (SO-08.10)', () => {
  const current = useFreshApp();

  describe('SO-08.10 a client-supplied X-Forwarded-For does not choose the address', () => {
    it('SO-08.10 varying first entries behind the proxy-appended last entry reach 429', async () => {
      const app = current();
      const proxyAddress = randomAddress();
      const codes = await statuses(app, PUBLIC_ROUTE, ADDRESS_LIMIT + 3, () => ({
        address: `${randomAddress()}, ${proxyAddress}`,
        headers: bearerOf(randomToken()),
      }));
      expect(codes.slice(ADDRESS_LIMIT).every((code) => code === 429)).toBe(true);
    });

    it('SO-08.10 the last entry is the address that is counted', async () => {
      const app = current();
      const [first, second] = [randomAddress(), randomAddress()];
      const spoofed = await statuses(app, PUBLIC_ROUTE, ADDRESS_LIMIT + 2, () => ({
        address: `${second}, ${first}`,
      }));
      expect(spoofed.at(-1)).toBe(429);
      // Same first entry as before, different last entry: a different client, not limited.
      const other = await hit(app, PUBLIC_ROUTE, { address: `${first}, ${randomAddress()}` });
      expect(other.status).not.toBe(429);
    });
  });
});

describe('Rate limit response and recovery (SO-08.9)', () => {
  it('SO-08.9 a 429 has Retry-After and a generic body, logs nothing sensitive, and recovers', async () => {
    const app = await bootApp('test', {
      RATE_LIMIT_PER_MINUTE: String(LIMIT),
      RATE_LIMIT_WINDOW_SECONDS: '1',
    });
    const session = await signIn(app, USERS.patientA);
    const address = randomAddress();
    const output = captureLogLines();
    let limited: request.Response | undefined;
    try {
      for (let i = 0; i < LIMIT + 1; i += 1) {
        limited = await hit(app, PROTECTED_ROUTE, { address, headers: bearer(session) });
      }
    } finally {
      output.stop();
    }
    const limitedLogs = output.text();
    expect(limited?.status).toBe(429);
    const retryAfter = Number(limited?.headers['retry-after']);
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(1);
    expect(limited?.body).toMatchObject({ statusCode: 429, error: 'ThrottlerException' });
    for (const text of [
      JSON.stringify(limited?.body),
      JSON.stringify(limited?.headers),
      limitedLogs,
    ]) {
      expect(text).not.toContain(session.token);
      expect(text).not.toContain(address);
      expect(text).not.toContain(USERS.patientA);
    }
    expect(limitedLogs).toContain('"status":429');

    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect((await hit(app, PROTECTED_ROUTE, { address, headers: bearer(session) })).status).toBe(
      200,
    );
    await app.close();
  });
});

describe('Rate limit edge cases (SO-08.4, SO-08.6)', () => {
  const current = useFreshApp();

  it('SO-08.4 the health probes stay exempt when requests carry fake tokens', async () => {
    const app = current();
    const address = randomAddress();
    for (const route of ['/healthz', '/readyz']) {
      const codes = await statuses(app, route, 2 * ADDRESS_LIMIT, () => ({
        address,
        headers: bearerOf(randomToken()),
      }));
      expect(codes.every((code) => code !== 429)).toBe(true);
    }
  });

  it('SO-08.4 the health probes stay exempt for a signed-in caller', async () => {
    const app = current();
    const a = await signIn(app, USERS.patientA);
    const codes = await statuses(app, '/healthz', 2 * LIMIT, () => ({
      address: randomAddress(),
      headers: bearer(a),
    }));
    expect(codes.every((code) => code !== 429)).toBe(true);
  });

  it('SO-08.6 a valid token on a public route is also counted by its user', async () => {
    const app = current();
    const [a, b] = [await signIn(app, USERS.patientA), await signIn(app, USERS.patientB)];
    const address = randomAddress();
    const first = await statuses(app, PUBLIC_ROUTE, LIMIT + 2, () => ({
      address,
      headers: bearer(a),
    }));
    expect(first.at(-1)).toBe(429);
    // Another user at the same address, on the same public route, has an allowance of their own.
    expect((await hit(app, PUBLIC_ROUTE, { address, headers: bearer(b) })).status).not.toBe(429);
  });

  it('SO-08.6 a caller of the wrong role is counted before it is refused with 403', async () => {
    const app = current();
    const provider = await signIn(app, USERS.provider);
    const address = randomAddress();
    const codes = await statuses(app, PROTECTED_ROUTE, LIMIT + 2, () => ({
      address,
      headers: bearer(provider),
    }));
    expect(codes.slice(0, LIMIT)).toEqual(Array(LIMIT).fill(403));
    expect(codes.slice(LIMIT)).toEqual([429, 429]);
  });
});
