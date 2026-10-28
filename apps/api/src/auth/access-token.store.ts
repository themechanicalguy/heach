import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { Principal } from '../common/request-context.js';
import { REDIS_CLIENT } from '../data-stores/data-stores.tokens.js';
import { hashToken, newToken } from './token-hash.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // SE-07.1: at most 15 minutes

/**
 * Opaque access tokens in Redis, keyed by their hash, so they can be revoked at once (SE-07.3).
 * Each token hash is also kept in its user's set (revoke-all) and its device's session-family set
 * (sign-out of one device, SE-07.21), so a token issued before a refresh is revoked with it.
 */
@Injectable()
export class AccessTokenStore {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async issue(
    principal: Principal,
    familyId: string,
    ttlSeconds = ACCESS_TOKEN_TTL_SECONDS,
  ): Promise<string> {
    const { token, hash } = newToken();
    await this.redis
      .multi()
      .set(`at:${hash}`, JSON.stringify(principal), 'EX', ttlSeconds)
      .sadd(userKey(principal.userId), hash)
      .expire(userKey(principal.userId), ACCESS_TOKEN_TTL_SECONDS)
      .sadd(familyKey(familyId), hash)
      .expire(familyKey(familyId), ACCESS_TOKEN_TTL_SECONDS)
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
    await this.revokeSet(userKey(userId));
  }

  /** Every access token issued to one device's session family, before or after refreshes. */
  async revokeFamily(familyId: string): Promise<void> {
    await this.revokeSet(familyKey(familyId));
  }

  private async revokeSet(key: string): Promise<void> {
    const hashes = await this.redis.smembers(key);
    await this.redis.del(...hashes.map((hash) => `at:${hash}`), key);
  }
}

const userKey = (userId: string) => `user-at:${userId}`;
const familyKey = (familyId: string) => `family-at:${familyId}`;
