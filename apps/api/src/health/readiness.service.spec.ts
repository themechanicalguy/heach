import { ReadinessService } from './readiness.service.js';

const ok = () => Promise.resolve('ok');
const fail = () => Promise.reject(new Error('connection refused'));
const hang = () => new Promise(() => undefined);

function service(query: () => Promise<unknown>, ping: () => Promise<unknown>) {
  return new ReadinessService({ query } as never, { ping } as never);
}

describe('ReadinessService', () => {
  it('is ok when PostgreSQL and Redis both answer', async () => {
    await expect(service(ok, ok).check()).resolves.toEqual({
      status: 'ok',
      checks: { postgres: 'ok', redis: 'ok' },
    });
  });

  it('reports the failing dependency as down, without error details', async () => {
    await expect(service(fail, ok).check()).resolves.toEqual({
      status: 'error',
      checks: { postgres: 'down', redis: 'ok' },
    });
  });

  it('treats a dependency that does not answer within 1 s as down', async () => {
    vi.useFakeTimers();
    const result = service(ok, hang).check();
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(result).resolves.toMatchObject({ checks: { redis: 'down' } });
    vi.useRealTimers();
  });
});
