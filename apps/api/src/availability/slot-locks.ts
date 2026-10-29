import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../data-stores/data-stores.tokens.js';

/** How long a slot stays held during checkout (AV-02, AD-08). */
export const SLOT_LOCK_SECONDS = 10 * 60;

const key = (providerId: string, start: Date) => `slot-lock:${providerId}:${start.toISOString()}`;

/**
 * Holds a provider's slot for one patient during checkout (AV-02). SET NX makes the hold atomic:
 * two patients can never hold the same slot; the TTL frees it if checkout is abandoned.
 */
@Injectable()
export class SlotLocks {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async acquire(providerId: string, start: Date, holder: string): Promise<boolean> {
    const current = await this.redis.get(key(providerId, start));
    if (current === holder) return true;
    const set = await this.redis.set(key(providerId, start), holder, 'EX', SLOT_LOCK_SECONDS, 'NX');
    return set === 'OK';
  }

  async holder(providerId: string, start: Date): Promise<string | null> {
    return this.redis.get(key(providerId, start));
  }

  async release(providerId: string, start: Date, holder: string): Promise<void> {
    if ((await this.holder(providerId, start)) === holder)
      await this.redis.del(key(providerId, start));
  }

  /** Which of these starts someone other than `viewer` is holding now. */
  async heldByOthers(
    providerId: string,
    starts: readonly Date[],
    viewer?: string,
  ): Promise<Set<number>> {
    if (starts.length === 0) return new Set();
    const values = await this.redis.mget(...starts.map((start) => key(providerId, start)));
    return new Set(
      starts
        .filter((_, index) => values[index] && values[index] !== viewer)
        .map((start) => start.getTime()),
    );
  }
}
