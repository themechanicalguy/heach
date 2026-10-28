import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { EnvVars } from '../config/env.schema.js';
import { REDIS_CLIENT } from '../data-stores/data-stores.tokens.js';

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

/** Who an OTP request comes from: the number's blind index, the device cookie and the address. */
export interface OtpRequester {
  mobileIndex: string;
  deviceId: string;
  address: string;
}

interface Cap {
  key: string;
  limit: number;
  windowSeconds: number;
}

/** 429 with Retry-After and a stable code; the body says nothing about the number. */
export class OtpRateLimitedException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super(
      { error: 'Too Many Requests', message: 'Too many requests', code: 'otp_rate_limited' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/**
 * Caps on OTP sends per number, device and address, and on wrong codes per address (SE-08,
 * decision L-6). Fixed windows in Redis, shared by every API process. Keys hold only the blind
 * index, a random device ID and the address, never a number.
 */
@Injectable()
export class OtpThrottle {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly env: EnvVars,
  ) {}

  /** Counts one send against every cap; throws when any cap is already used up. */
  async consumeSend(requester: OtpRequester): Promise<void> {
    await this.consume([
      cap(`num-h:${requester.mobileIndex}`, this.env.OTP_SENDS_PER_NUMBER_PER_HOUR, HOUR),
      cap(`num-d:${requester.mobileIndex}`, this.env.OTP_SENDS_PER_NUMBER_PER_DAY, DAY),
      cap(`dev-h:${requester.deviceId}`, this.env.OTP_SENDS_PER_DEVICE_PER_HOUR, HOUR),
      cap(`ip-h:${requester.address}`, this.env.OTP_SENDS_PER_ADDRESS_PER_HOUR, HOUR),
    ]);
  }

  /** Refuses verification from an address that has sent too many wrong codes this hour. */
  async assertVerifyAllowed(address: string): Promise<void> {
    const key = failureKey(address);
    const count = Number((await this.redis.get(key)) ?? 0);
    if (count >= this.env.OTP_FAILURES_PER_ADDRESS_PER_HOUR) {
      throw new OtpRateLimitedException(Math.max(await this.redis.ttl(key), 1));
    }
  }

  async recordFailure(address: string): Promise<void> {
    await this.increment(cap(failureKey(address), 0, HOUR));
  }

  private async consume(caps: Cap[]): Promise<void> {
    const counts = await Promise.all(caps.map((each) => this.increment(each)));
    const exceeded = caps.findIndex((each, i) => (counts[i] ?? 0) > each.limit);
    if (exceeded >= 0) {
      const ttl = await this.redis.ttl(caps[exceeded]?.key ?? '');
      throw new OtpRateLimitedException(Math.max(ttl, 1));
    }
  }

  private async increment({ key, windowSeconds }: Cap): Promise<number> {
    const result = await this.redis.multi().incr(key).expire(key, windowSeconds, 'NX').exec();
    return Number(result?.[0]?.[1] ?? 0);
  }
}

const cap = (key: string, limit: number, windowSeconds: number): Cap => ({
  key: `otp-cap:${key}`,
  limit,
  windowSeconds,
});

const failureKey = (address: string) => `otp-cap:fail-h:${address}`;
