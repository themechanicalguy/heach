import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../data-stores/data-stores.tokens.js';
import { ALERT_PUBLISHER, type AlertPublisher } from './alert-publisher.js';

export const UNUSUAL_READ_THRESHOLD = 50;
export const UNUSUAL_READ_WINDOW_SECONDS = 60 * 60;

/**
 * Fifty vault records read by one provider or one shared link within an hour raise one alert
 * (SO-08, AD-17). Only the reader's ID goes in the alert, never what was read.
 */
@Injectable()
export class UnusualReadMonitor {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(ALERT_PUBLISHER) private readonly alerts: AlertPublisher,
  ) {}

  async record(reader: string): Promise<void> {
    const key = `record-reads:${reader}`;
    const [[, count]] = (await this.redis
      .multi()
      .incr(key)
      .expire(key, UNUSUAL_READ_WINDOW_SECONDS, 'NX')
      .exec()) as [[null, number], unknown];
    if (count === UNUSUAL_READ_THRESHOLD) {
      await this.redis.incr(dayKey('unusual-readers'));
      await this.redis.expire(dayKey('unusual-readers'), 2 * 86_400);
      await this.alerts.publish(
        'HEACH: unusual record reads',
        `${String(UNUSUAL_READ_THRESHOLD)} vault records read within an hour by ${reader}.`,
      );
    }
  }
}

/** A Redis key for today's count of something, by the UTC date. */
export function dayKey(name: string, at = new Date()): string {
  return `${name}:${at.toISOString().slice(0, 10)}`;
}
