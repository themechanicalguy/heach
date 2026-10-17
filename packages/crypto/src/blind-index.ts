import { createHmac, hkdfSync } from 'node:crypto';
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

/** Derives one blind index key per domain from a single root key (EN-09.1). */
export function deriveBlindIndexKeys(rootKey: Buffer): Record<DataDomain, Buffer> {
  const derive = (domain: DataDomain) =>
    Buffer.from(hkdfSync('sha256', rootKey, 'heach-blind-index', domain, 32));
  return {
    health: derive('health'),
    identity: derive('identity'),
    payments: derive('payments'),
    documents: derive('documents'),
  };
}
