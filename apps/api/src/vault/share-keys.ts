import { createHmac, hkdfSync, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EnvVars } from '../config/env.schema.js';

/**
 * Tokens and codes of external share links (MV-09). Only keyed hashes are stored, under a key
 * derived from the blind-index root key with its own label; the token and code are shown once.
 */
@Injectable()
export class ShareKeys {
  private readonly key: Buffer;

  constructor(env: EnvVars) {
    this.key = Buffer.from(
      hkdfSync('sha256', Buffer.from(env.BLIND_INDEX_KEY, 'hex'), 'heach-share', 'share-link', 32),
    );
  }

  newToken(): string {
    return randomBytes(24).toString('base64url');
  }

  newCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  hash(value: string): string {
    return createHmac('sha256', this.key).update(value).digest('hex');
  }

  matches(value: string, stored: string): boolean {
    const given = Buffer.from(this.hash(value), 'hex');
    const expected = Buffer.from(stored, 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  }
}
