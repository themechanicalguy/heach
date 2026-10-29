import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';
import { randomBytes } from 'node:crypto';
import type { Principal } from '../common/request-context.js';
import type { AccessTokenStore } from '../auth/access-token.store.js';
import { ADDRESS_THROTTLER, USER_THROTTLER, UserThrottlerGuard } from './user-throttler.guard.js';

const ADDRESS = '203.0.113.7';
const ADDRESS_LIMIT = 6;
const USER_LIMIT = 3;
const USER_ID = '00000000-0000-4000-8000-000000000001';
const principalOf = (userId: string): Principal => ({
  userId,
  role: 'patient',
  sessionId: 'session-1',
  realm: 'user',
});

type Resolve = AccessTokenStore['resolve'];

async function guardWith(resolve: Resolve) {
  const lookup = vi.fn(resolve);
  const tokens = { resolve: lookup } as unknown as AccessTokenStore;
  const storage = new ThrottlerStorageService();
  const options = [
    { name: ADDRESS_THROTTLER, ttl: 60_000, limit: ADDRESS_LIMIT },
    { name: USER_THROTTLER, ttl: 60_000, limit: USER_LIMIT },
  ];
  const guard = new UserThrottlerGuard(options, storage, new Reflector(), tokens);
  await guard.onModuleInit();
  return { guard, storage, resolve: lookup };
}

// Stand in for a controller and its method; the guard reads only their (absent) metadata.
const controller = () => undefined;
const handler = () => undefined;

function contextFor(authorization: string | undefined, ip: string | null = ADDRESS) {
  const headers: Record<string, string | number> = {};
  const request = {
    ip: ip ?? undefined,
    headers: {},
    header: (name: string) => (name.toLowerCase() === 'authorization' ? authorization : undefined),
  };
  const response = { header: (name: string, value: string | number) => (headers[name] = value) };
  const context = {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
  return { context, headers };
}

/** 'ok' or 429 for each of `count` requests. */
async function outcomes(
  guard: UserThrottlerGuard,
  count: number,
  next: (i: number) => { authorization?: string | undefined; ip?: string | null },
): Promise<('ok' | 429)[]> {
  const out: ('ok' | 429)[] = [];
  for (let i = 0; i < count; i += 1) {
    const { authorization, ip } = next(i);
    try {
      await guard.canActivate(contextFor(authorization, ip).context);
      out.push('ok');
    } catch (error) {
      if (!(error instanceof ThrottlerException)) throw error;
      out.push(429);
    }
  }
  return out;
}

const randomToken = () => randomBytes(24).toString('base64url');
const bearer = () => `Bearer ${randomToken()}`;
const limitedAfter = (limit: number, count: number) => [
  ...Array<'ok'>(limit).fill('ok'),
  ...Array<429>(count - limit).fill(429),
];

describe('UserThrottlerGuard', () => {
  it('SO-08.12 different invalid bearer tokens from one address share its limit', async () => {
    const { guard } = await guardWith(() => Promise.resolve(undefined));
    const codes = await outcomes(guard, ADDRESS_LIMIT + 4, () => ({ authorization: bearer() }));
    expect(codes).toEqual(limitedAfter(ADDRESS_LIMIT, ADDRESS_LIMIT + 4));
  });

  it('SO-08.12 valid tokens of different users do not lift the address limit', async () => {
    const { guard } = await guardWith(() => Promise.resolve(principalOf(`user-${randomToken()}`)));
    const codes = await outcomes(guard, ADDRESS_LIMIT + 2, () => ({ authorization: bearer() }));
    expect(codes).toEqual(limitedAfter(ADDRESS_LIMIT, ADDRESS_LIMIT + 2));
  });

  it("SO-08.6 one user's tokens share one user allowance across addresses", async () => {
    const { guard } = await guardWith(() => Promise.resolve(principalOf(USER_ID)));
    const codes = await outcomes(guard, USER_LIMIT + 2, (i) => ({
      authorization: bearer(),
      ip: `198.51.100.${String(i)}`,
    }));
    expect(codes).toEqual(limitedAfter(USER_LIMIT, USER_LIMIT + 2));
  });

  it('SO-08.8 a thousand fake tokens add no counters beyond the address', async () => {
    const { guard, storage } = await guardWith(() => Promise.resolve(undefined));
    await outcomes(guard, 1000, () => ({ authorization: bearer() }));
    expect(storage.storage.size).toBe(1);
  });

  it.each([
    ['no header', undefined],
    ['wrong scheme', `Basic ${randomToken()}`],
    ['too short', 'Bearer abc123'],
    ['bad characters', 'Bearer !!!!!!!!!!!!!!!!!!!!!!!!'],
    ['empty', ''],
  ])('SO-08.5 %s is counted by address without a session lookup', async (_name, header) => {
    const { guard, resolve, storage } = await guardWith(() =>
      Promise.resolve(principalOf(USER_ID)),
    );
    await outcomes(guard, 1, () => ({ authorization: header }));
    expect(resolve).not.toHaveBeenCalled();
    expect([...storage.storage.keys()]).toHaveLength(1);
  });

  it('SO-08.4 a missing client address is still counted', async () => {
    const { guard } = await guardWith(() => Promise.resolve(undefined));
    const codes = await outcomes(guard, ADDRESS_LIMIT + 1, () => ({ ip: null }));
    expect(codes.at(-1)).toBe(429);
  });

  it.each([
    ['rejects', () => Promise.reject(new Error('redis down'))],
    [
      'throws',
      () => {
        throw new Error('redis down');
      },
    ],
  ])('SO-08.11 a session store that %s leaves the address limit in force', async (_n, failure) => {
    const { guard } = await guardWith(failure);
    const codes = await outcomes(guard, ADDRESS_LIMIT + 1, () => ({ authorization: bearer() }));
    expect(codes).toEqual(limitedAfter(ADDRESS_LIMIT, ADDRESS_LIMIT + 1));
  });

  it('SO-08.9 either limit answers with a plain Retry-After header', async () => {
    const { guard } = await guardWith(() => Promise.resolve(principalOf(USER_ID)));
    await outcomes(guard, USER_LIMIT, () => ({ authorization: bearer() }));
    const { context, headers } = contextFor(bearer());
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ThrottlerException);
    expect(headers['Retry-After']).toBeGreaterThan(0);
    expect(Object.keys(headers).filter((name) => name.startsWith('Retry-After-'))).toEqual([]);
  });

  it('SO-08.11 a session-store failure is not logged with the token or address', async () => {
    const { guard } = await guardWith(() => Promise.reject(new Error('redis down')));
    const written: string[] = [];
    const spy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: string | Uint8Array) => !!written.push(String(chunk)));
    const out = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => !!written.push(String(chunk)));
    const token = randomToken();
    await outcomes(guard, 1, () => ({ authorization: `Bearer ${token}` }));
    spy.mockRestore();
    out.mockRestore();
    expect(written.join('')).not.toContain(token);
    expect(written.join('')).not.toContain(ADDRESS);
  });
});
