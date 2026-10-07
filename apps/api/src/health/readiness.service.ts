import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type pg from 'pg';
import { PG_POOL, REDIS_CLIENT } from '../data-stores/data-stores.tokens.js';

export type CheckName = 'postgres' | 'redis';
export type CheckState = 'ok' | 'down';

export interface Readiness {
  status: 'ok' | 'error';
  checks: Record<CheckName, CheckState>;
}

const CHECK_TIMEOUT_MS = 1_000;

/** Readiness = every dependency answers within the timeout. Reports only up or down. */
@Injectable()
export class ReadinessService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>,
    @Inject(REDIS_CLIENT) private readonly redis: Pick<Redis, 'ping'>,
  ) {}

  async check(): Promise<Readiness> {
    const [postgres, redis] = await Promise.all([
      probe(() => this.pool.query('SELECT 1')),
      probe(() => this.redis.ping()),
    ]);
    const healthy = postgres === 'ok' && redis === 'ok';
    return { status: healthy ? 'ok' : 'error', checks: { postgres, redis } };
  }
}

async function probe(run: () => Promise<unknown>): Promise<CheckState> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('timeout'));
    }, CHECK_TIMEOUT_MS);
  });
  try {
    await Promise.race([run(), timeout]);
    return 'ok';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}
