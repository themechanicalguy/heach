import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { Request } from 'express';
import { AccessTokenStore } from '../auth/access-token.store.js';
import { bearerToken } from '../auth/auth.guard.js';
import type { Principal } from '../common/request-context.js';

/**
 * Counts per user for a live session and per client address for everything else (SO-08.4 to
 * SO-08.8, SO-08.11). A made-up, expired or revoked token never gets an allowance of its own.
 * This guard only reads the session store; authentication stays in AuthGuard.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly tokens: AccessTokenStore,
  ) {
    super(options, storageService, reflector);
  }

  protected override async getTracker(request: Record<string, unknown>): Promise<string> {
    const req = request as unknown as Request;
    const principal = await this.liveSession(req);
    return principal ? `user:${principal.userId}` : `ip:${req.ip ?? 'unknown'}`;
  }

  /** A store failure counts the request by address instead of letting it through uncounted. */
  private async liveSession(request: Request): Promise<Principal | undefined> {
    const token = bearerToken(request);
    if (!token) {
      return undefined;
    }
    try {
      return await this.tokens.resolve(token);
    } catch {
      return undefined;
    }
  }
}
