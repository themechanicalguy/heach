import { createHmac, hkdfSync, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { readCookie } from '../common/cookies.js';
import { EnvVars } from '../config/env.schema.js';

const COOKIE = 'heach_referral_device';
const COOKIE_PATH = '/api/v1/me/referral';
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * A random ID per browser used only to hold a second referral reward from the same device for
 * review (RR-06, owner decision on 30 October 2026). It is separate from the sign-in device
 * cookie, identifies no person, is never logged, and is stored only as a keyed hash under a key
 * derived from the blind-index root key with its own label.
 */
@Injectable()
export class ReferralDevices {
  private readonly key: Buffer;

  constructor(env: EnvVars) {
    this.key = Buffer.from(
      hkdfSync('sha256', Buffer.from(env.BLIND_INDEX_KEY, 'hex'), 'heach-referral', 'device', 32),
    );
  }

  /** The keyed hash of this browser's referral device ID; a browser without one gets one. */
  hashFor(request: Request, response: Response): string {
    let id = readCookie(request, COOKIE);
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
      id = randomUUID();
      response.cookie(COOKIE, id, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: COOKIE_PATH,
        expires: new Date(Date.now() + YEAR_MS),
      });
    }
    return createHmac('sha256', this.key).update(id).digest('hex');
  }
}
