import { createHmac } from 'node:crypto';
import type { DataDomain } from './types.js';

/**
 * HMAC-SHA-256 lookup value for a searchable Restricted field (EN-09). Each domain has its own
 * key, so equal values in two domains do not match. Input is normalised before hashing.
 */
export class BlindIndexer {
  constructor(private readonly keys: Readonly<Record<DataDomain, Buffer>>) {}

  index(domain: DataDomain, value: string): string {
    const key = this.keys[domain];
    if (key.length < 32) {
      throw new Error(`Blind index key for ${domain} is shorter than 32 bytes`);
    }
    return createHmac('sha256', key)
      .update(value.normalize('NFC').trim().toLowerCase(), 'utf8')
      .digest('hex');
  }
}
