import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { Principal } from '../common/request-context.js';
import { REDIS_CLIENT } from '../data-stores/data-stores.tokens.js';
import { hashToken, newToken } from './token-hash.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // SE-07.1: at most 15 minutes

/**
 * Opaque access tokens in Redis, keyed by their hash, so they can be revoked at once (SE-07.3).
 * Each user's token hashes are also kept in a set for revoke-all.
 */
@Injectable()
export class AccessTokenStore {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async issue(principal: Principal): Promise<string> {
    const { token, hash } = newToken();
    await this.redis
      .multi()
      .set(`at:${hash}`, JSON.stringify(principal), 'EX', ACCESS_TOKEN_TTL_SECONDS)
      .sadd(`user-at:${principal.userId}`, hash)
      .expire(`user-at:${principal.userId}`, ACCESS_TOKEN_TTL_SECONDS)
      .exec();
    return token;
  }

  async resolve(token: string): Promise<Principal | undefined> {
    const value = await this.redis.get(`at:${hashToken(token)}`);
    return value ? (JSON.parse(value) as Principal) : undefined;
  }

  async revoke(token: string): Promise<void> {
    await this.redis.del(`at:${hashToken(token)}`);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const hashes = await this.redis.smembers(`user-at:${userId}`);
    await this.redis.del(...hashes.map((hash) => `at:${hash}`), `user-at:${userId}`);
  }
}
