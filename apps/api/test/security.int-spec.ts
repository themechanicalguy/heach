import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../src/data-stores/data-stores.tokens.js';
import { ALERT_PUBLISHER, type AlertPublisher } from '../src/security/alert-publisher.js';
import {
  dayKey,
  UNUSUAL_READ_THRESHOLD,
  UnusualReadMonitor,
} from '../src/security/unusual-read.monitor.js';
import { adminSignIn } from './account-helpers.js';
import { bearer, login, USERS } from './auth-helpers.js';
import { bootApp } from './boot-app.js';

describe('Security headers (SO-05.1, EN-01.2)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await bootApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['/healthz', '/v1/sample/notes', '/does-not-exist'])(
    'SO-05.1 EN-01.2 %s carries the security headers',
    async (path) => {
      const { headers } = await request(app.getHttpServer()).get(path);
      expect(headers['strict-transport-security']).toMatch(/max-age=(\d+)/);
      expect(
        Number(/max-age=(\d+)/.exec(headers['strict-transport-security'] ?? '')?.[1]),
      ).toBeGreaterThanOrEqual(31_536_000);
      // No inline scripts; inline styles are outside SO-05.1.
      const directives = (headers['content-security-policy'] ?? '').split(';');
      expect(directives.find((d) => d.startsWith('script-src '))).toBe("script-src 'self'");
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['x-content-type-options']).toBe('nosniff');
    },
  );

  it('LM-01 echoes a correlation ID on every response', async () => {
    const { headers } = await request(app.getHttpServer())
      .get('/healthz')
      .set('x-correlation-id', 'corr-abc-12345');
    expect(headers['x-correlation-id']).toBe('corr-abc-12345');
  });
});

describe('Rate limits (SO-08.1)', () => {
  it('SO-08.1 more than the configured requests per minute returns 429', async () => {
    const app = await bootApp('test', { RATE_LIMIT_PER_MINUTE: '5' });
    const session = await login(app, USERS.patientA);
    const statuses: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      statuses.push(
        (await request(app.getHttpServer()).get('/v1/sample/notes').set(bearer(session))).status,
      );
    }
    expect(statuses.slice(0, 4).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    await app.close();
  });
});

describe('Authorisation failure alert (SO-08.3)', () => {
  it('SO-08.3 ten failures from one user within five minutes raise one alert', async () => {
    const app = await bootApp();
    await app.get<Redis>(REDIS_CLIENT).del(`authz-fail:${USERS.provider}`);
    const publish = vi.spyOn(app.get<AlertPublisher>(ALERT_PUBLISHER), 'publish');
    const provider = await login(app, USERS.provider);
    for (let i = 0; i < 11; i += 1) {
      await request(app.getHttpServer()).get('/v1/sample/notes').set(bearer(provider)).expect(403);
    }
    expect(publish).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(publish.mock.calls[0])).toContain(USERS.provider);
    await app.close();
  });
});

describe('Unusual reads and the security console (AD-17)', () => {
  it('AD-17 one reader crossing the hourly threshold raises one alert, counted on the console', async () => {
    const app = await bootApp();
    const redis = app.get<Redis>(REDIS_CLIENT);
    const reader = `synthetic-reader-${String(Date.now())}`;
    const publish = vi.spyOn(app.get<AlertPublisher>(ALERT_PUBLISHER), 'publish');
    const before = Number((await redis.get(dayKey('unusual-readers'))) ?? 0);
    for (let i = 0; i <= UNUSUAL_READ_THRESHOLD; i += 1) {
      await app.get(UnusualReadMonitor).record(reader);
    }
    expect(publish).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(publish.mock.calls[0])).toContain(reader);

    const admin = await adminSignIn(app, 'super_admin');
    const security = (
      await request(app.getHttpServer()).get('/admin/v1/security').set(bearer(admin)).expect(200)
    ).body as {
      unusualReadersToday: number;
      authzFailuresToday: number;
      adminAccess: { email: string; stale: boolean; lastSignInAt: string | null }[];
    };
    expect(security.unusualReadersToday).toBe(before + 1);
    expect(typeof security.authzFailuresToday).toBe('number');
    const me = security.adminAccess.find((row) => row.lastSignInAt !== null && !row.stale);
    expect(me).toBeTruthy();
    await app.close();
  });
});
