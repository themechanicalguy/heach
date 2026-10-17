import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { bearerToken } from '../auth/auth.guard.js';
import { hashToken } from '../auth/token-hash.js';

/** Counts per access token when signed in (one user), otherwise per client IP (SO-08.1). */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(request: Record<string, unknown>): Promise<string> {
    const req = request as unknown as Request;
    const token = bearerToken(req);
    return Promise.resolve(token ? `token:${hashToken(token)}` : `ip:${req.ip ?? 'unknown'}`);
  }
}
