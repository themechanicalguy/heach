import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import type { DataDomain } from './types.js';

/** A fresh data key: the plaintext stays in memory, only the wrapped form is stored (EN-04). */
export interface GeneratedDataKey {
  readonly plaintext: Buffer;
  readonly wrapped: Buffer;
}

/**
 * Wraps and unwraps data keys with a per-domain master key that never leaves the provider.
 * Production uses AWS KMS (`GenerateDataKey`, `Decrypt`); tests use `LocalKeyProvider`.
 */
export interface KeyProvider {
  generateDataKey(domain: DataDomain): Promise<GeneratedDataKey>;
  decryptDataKey(domain: DataDomain, wrapped: Buffer): Promise<Buffer>;
}

const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Test double for KMS, for local development and tests only. Without a seed each domain gets a
 * random master key held in this process; with a seed the master keys are derived from it, so
 * local data survives a restart.
 */
export class LocalKeyProvider implements KeyProvider {
  private readonly masters = new Map<DataDomain, Buffer>();
  readonly calls: { op: 'generate' | 'decrypt'; domain: DataDomain }[] = [];

  constructor(private readonly seed?: string) {}

  generateDataKey(domain: DataDomain): Promise<GeneratedDataKey> {
    this.calls.push({ op: 'generate', domain });
    const plaintext = randomBytes(32);
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.master(domain), iv);
    const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return Promise.resolve({ plaintext, wrapped: Buffer.concat([iv, cipher.getAuthTag(), body]) });
  }

  decryptDataKey(domain: DataDomain, wrapped: Buffer): Promise<Buffer> {
    this.calls.push({ op: 'decrypt', domain });
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.master(domain),
      wrapped.subarray(0, IV_BYTES),
      {
        authTagLength: TAG_BYTES,
      },
    );
    decipher.setAuthTag(wrapped.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Promise.resolve(
      Buffer.concat([decipher.update(wrapped.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]),
    );
  }

  private master(domain: DataDomain): Buffer {
    let key = this.masters.get(domain);
    if (!key) {
      key = this.seed
        ? Buffer.from(hkdfSync('sha256', this.seed, 'heach-local-kms', domain, 32))
        : randomBytes(32);
      this.masters.set(domain, key);
    }
    return key;
  }
}
