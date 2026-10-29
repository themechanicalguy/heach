import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EnvVars } from '../config/env.schema.js';

/**
 * The one-time codes that start a visit or check a shift in and out (HS-03, HS-05). Each is
 * derived from the booking, the moment it is for, and a key derived from the blind-index root
 * key, so nothing is stored and a code works for its own booking and moment only.
 */
@Injectable()
export class VisitCodes {
  private readonly key: Buffer;

  constructor(env: EnvVars) {
    this.key = Buffer.from(
      hkdfSync('sha256', Buffer.from(env.BLIND_INDEX_KEY, 'hex'), 'heach-visit', 'visit-code', 32),
    );
  }

  /** `moment` is `visit`, or `shift:N:in` and `shift:N:out`. */
  code(bookingId: string, moment: string): string {
    const digest = createHmac('sha256', this.key).update(`${bookingId}:${moment}`).digest();
    return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, '0');
  }

  matches(bookingId: string, moment: string, code: string): boolean {
    const expected = Buffer.from(this.code(bookingId, moment));
    const given = Buffer.from(code.padEnd(6, ' ').slice(0, 6));
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
