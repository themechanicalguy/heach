import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { Service } from '../catalogue/services.js';
import { REDIS_CLIENT } from '../data-stores/data-stores.tokens.js';
import type { PinSummary } from './coverage-pins.js';

export const COVERAGE_PINS_TTL_SECONDS = 5 * 60;
const PREFIX = 'coverage:pins:v1:';

/**
 * Shared cache of the public serviceable-PIN list. It holds Public aggregates only, so it is safe
 * to share between instances. A Redis outage means a slower answer, never a failed one.
 */
@Injectable()
export class CoveragePinsCache {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async read(service: Service): Promise<PinSummary[] | undefined> {
    try {
      const value = await this.redis.get(PREFIX + service);
      return value ? (JSON.parse(value) as PinSummary[]) : undefined;
    } catch {
      return undefined;
    }
  }

  async write(service: Service, pins: readonly PinSummary[]): Promise<void> {
    try {
      await this.redis.set(PREFIX + service, JSON.stringify(pins), 'EX', COVERAGE_PINS_TTL_SECONDS);
    } catch {
      // The next request recomputes it.
    }
  }

  /** Called when a provider is approved, suspended or changes a listing or service area. */
  async invalidate(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${PREFIX}*`);
      if (keys.length > 0) await this.redis.del(...keys);
    } catch {
      // The entry still expires on its own within the TTL.
    }
  }
}
