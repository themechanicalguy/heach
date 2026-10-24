import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerRequest,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { Request } from 'express';
import { AccessTokenStore } from '../auth/access-token.store.js';
import { bearerToken } from '../auth/auth.guard.js';
import type { Principal } from '../common/request-context.js';

/** Counts every request by client address, whatever credentials it carries. */
export const ADDRESS_THROTTLER = 'default';
/** Counts a live session's requests by user, on top of the address limit. */
export const USER_THROTTLER = 'user';

/**
 * Every request is counted by client address, so no header can buy a fresh allowance; a request
 * whose token resolves to a live session is counted by its user as well (SO-08.4 to SO-08.8,
 * SO-08.11, SO-08.12). This guard only reads the session store; authentication stays in AuthGuard.
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

  protected override async handleRequest(props: ThrottlerRequest): Promise<boolean> {
    const req = props.context.switchToHttp().getRequest<Request>();
    if (props.throttler.name !== USER_THROTTLER) {
      return super.handleRequest({ ...props, getTracker: () => addressTracker(req) });
    }
    const principal = await this.liveSession(req);
    if (!principal) {
      return true;
    }
    return super.handleRequest({ ...props, getTracker: () => `user:${principal.userId}` });
  }

  /** Both limits answer with the standard `Retry-After`, not a per-limit variant. */
  protected override setResponseHeader(
    res: Record<string, unknown>,
    name: string,
    value: string | number,
  ): void {
    super.setResponseHeader(res, name.startsWith('Retry-After') ? 'Retry-After' : name, value);
  }

  /** A store failure leaves only the address limit instead of failing the request. */
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

function addressTracker(request: Request): string {
  return `ip:${request.ip ?? 'unknown'}`;
}
