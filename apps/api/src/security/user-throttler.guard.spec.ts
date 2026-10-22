import { Reflector } from '@nestjs/core';
import type { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { randomBytes } from 'node:crypto';
import type { Principal } from '../common/request-context.js';
import type { AccessTokenStore } from '../auth/access-token.store.js';
import { UserThrottlerGuard } from './user-throttler.guard.js';

const ADDRESS = '203.0.113.7';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const PRINCIPAL: Principal = { userId: USER_ID, role: 'patient', sessionId: 'session-1' };

type Resolve = AccessTokenStore['resolve'];

function guardWith(resolve: Resolve) {
  const lookup = vi.fn(resolve);
  const tokens = { resolve: lookup } as unknown as AccessTokenStore;
  const options = [{ ttl: 60_000, limit: 5 }] as ThrottlerModuleOptions;
  const guard = new UserThrottlerGuard(options, {} as ThrottlerStorage, new Reflector(), tokens);
  return { guard, resolve: lookup };
}

function trackerOf(guard: UserThrottlerGuard, authorization?: string, ip: string | null = ADDRESS) {
  const request = {
    ip: ip ?? undefined,
    header: (name: string) => (name.toLowerCase() === 'authorization' ? authorization : undefined),
  };
  return (
    guard as unknown as { getTracker(req: Record<string, unknown>): Promise<string> }
  ).getTracker(request);
}

const randomToken = () => randomBytes(24).toString('base64url');

describe('UserThrottlerGuard tracker', () => {
  it('SO-08.6 a token that resolves to a live session is counted by its user', async () => {
    const { guard } = guardWith(() => Promise.resolve(PRINCIPAL));
    const first = await trackerOf(guard, `Bearer ${randomToken()}`);
    const second = await trackerOf(guard, `Bearer ${randomToken()}`);
    expect(first).toBe(`user:${USER_ID}`);
    expect(second).toBe(first);
  });

  it('SO-08.8 many fake tokens give one tracker', async () => {
    const { guard } = guardWith(() => Promise.resolve(undefined));
    const trackers = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      trackers.add(await trackerOf(guard, `Bearer ${randomToken()}`));
    }
    expect([...trackers]).toEqual([`ip:${ADDRESS}`]);
  });

  it.each([
    ['no header', undefined],
    ['wrong scheme', `Basic ${randomToken()}`],
    ['too short', 'Bearer abc123'],
    ['bad characters', 'Bearer !!!!!!!!!!!!!!!!!!!!!!!!'],
    ['empty', ''],
  ])('SO-08.5 %s is counted by address without a session lookup', async (_name, header) => {
    const { guard, resolve } = guardWith(() => Promise.resolve(PRINCIPAL));
    expect(await trackerOf(guard, header)).toBe(`ip:${ADDRESS}`);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('SO-08.4 a well-formed token with no live session is counted by address', async () => {
    const { guard, resolve } = guardWith(() => Promise.resolve(undefined));
    expect(await trackerOf(guard, `Bearer ${randomToken()}`)).toBe(`ip:${ADDRESS}`);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('SO-08.4 a missing client address still gives a tracker', async () => {
    const { guard } = guardWith(() => Promise.resolve(undefined));
    expect(await trackerOf(guard, undefined, null)).toBe('ip:unknown');
  });

  it.each([
    ['rejects', () => Promise.reject(new Error('redis down'))],
    [
      'throws',
      () => {
        throw new Error('redis down');
      },
    ],
  ])('SO-08.11 a session store that %s is counted by address', async (_name, failure) => {
    const { guard } = guardWith(failure);
    await expect(trackerOf(guard, `Bearer ${randomToken()}`)).resolves.toBe(`ip:${ADDRESS}`);
  });

  it('SO-08.11 a session-store failure is not logged with the token or address', async () => {
    const { guard } = guardWith(() => Promise.reject(new Error('redis down')));
    const written: string[] = [];
    const spy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: string | Uint8Array) => !!written.push(String(chunk)));
    const out = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => !!written.push(String(chunk)));
    const token = randomToken();
    await trackerOf(guard, `Bearer ${token}`);
    spy.mockRestore();
    out.mockRestore();
    expect(written.join('')).not.toContain(token);
    expect(written.join('')).not.toContain(ADDRESS);
  });
});
