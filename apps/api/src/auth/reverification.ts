import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../data-stores/data-stores.tokens.js';
import { principalOf } from './auth.guard.js';

/** How long a fresh OTP or TOTP unlocks sensitive actions (AC-05, decision L-11). */
export const REVERIFICATION_TTL_SECONDS = 5 * 60;

/** Marks one session as freshly re-verified, for a few minutes, in Redis. */
@Injectable()
export class ReverificationStore {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async mark(sessionId: string): Promise<void> {
    await this.redis.set(key(sessionId), '1', 'EX', REVERIFICATION_TTL_SECONDS);
  }

  async isFresh(sessionId: string): Promise<boolean> {
    return (await this.redis.exists(key(sessionId))) === 1;
  }
}

const key = (sessionId: string) => `reverified:${sessionId}`;

/**
 * Route guard for sensitive actions: the session must have proved a fresh OTP (users) or TOTP
 * (admins) within the last five minutes (SE-07, AC-05).
 * Runs after the global AuthGuard, so the principal is known.
 */
@Injectable()
export class RequireReverification implements CanActivate {
  constructor(private readonly store: ReverificationStore) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const principal = principalOf(context.switchToHttp().getRequest<Request>());
    if (!(await this.store.isFresh(principal.sessionId))) {
      throw new ForbiddenException({
        error: 'Forbidden',
        message: 'Re-verification required',
        code: 'reverification_required',
      });
    }
    return true;
  }
}
