import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../data-stores/data-stores.tokens.js';
import { ALERT_PUBLISHER, type AlertPublisher } from './alert-publisher.js';

export const AUTHZ_FAILURE_THRESHOLD = 10;
export const AUTHZ_FAILURE_WINDOW_SECONDS = 5 * 60;

/** Ten authorisation failures by one user within five minutes raise one alert (SO-08.3). */
@Injectable()
export class AuthzFailureMonitor {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(ALERT_PUBLISHER) private readonly alerts: AlertPublisher,
  ) {}

  async record(subject: string): Promise<void> {
    const key = `authz-fail:${subject}`;
    const [[, count]] = (await this.redis
      .multi()
      .incr(key)
      .expire(key, AUTHZ_FAILURE_WINDOW_SECONDS, 'NX')
      .exec()) as [[null, number], unknown];
    if (count === AUTHZ_FAILURE_THRESHOLD) {
      await this.alerts.publish(
        'HEACH: repeated authorisation failures',
        `${String(AUTHZ_FAILURE_THRESHOLD)} authorisation failures within 5 minutes from user ${subject}.`,
      );
    }
  }
}
