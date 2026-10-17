import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { DataKeyStore } from './data-key-store.js';
import type { KeyProvider } from './key-provider.js';
import type { DataDomain, EncryptedField, FieldEncryptor } from './types.js';

export const ALGORITHM = 'AES-256-GCM';
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class DecryptionError extends Error {
  constructor() {
    super('Decryption failed');
    this.name = 'DecryptionError';
  }
}

/**
 * Envelope encryption (EN-04): each domain has versioned data keys wrapped by its KMS master key.
 * Unwrapped keys are cached in memory only. The domain and key version are bound as additional
 * authenticated data, so a value moved to another domain or version fails to decrypt (EN-06).
 */
export class EnvelopeEncryptor implements FieldEncryptor {
  private readonly cache = new Map<string, Buffer>();

  constructor(
    private readonly keys: KeyProvider,
    private readonly store: DataKeyStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async encrypt(plaintext: string, domain: DataDomain): Promise<EncryptedField> {
    const version = await this.ensureCurrentVersion(domain);
    const key = await this.dataKey(domain, version);
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(aad(domain, version));
    const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const ciphertext = Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
    return { ciphertext, keyVersion: String(version), algorithm: ALGORITHM, domain };
  }

  async decrypt(field: EncryptedField): Promise<string> {
    const version = Number(field.keyVersion);
    if (field.algorithm !== ALGORITHM || !Number.isInteger(version)) {
      throw new DecryptionError();
    }
    try {
      const key = await this.dataKey(field.domain, version);
      const raw = Buffer.from(field.ciphertext, 'base64');
      const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, IV_BYTES));
      decipher.setAAD(aad(field.domain, version));
      decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
      return Buffer.concat([
        decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new DecryptionError();
    }
  }

  async currentKeyVersion(domain: DataDomain): Promise<string> {
    return String(await this.ensureCurrentVersion(domain));
  }

  /** Adds a new data key version for the domain; old versions stay readable (EN-05). */
  async rotate(domain: DataDomain): Promise<number> {
    const current = await this.store.current(domain);
    const version = (current?.version ?? 0) + 1;
    const generated = await this.keys.generateDataKey(domain);
    await this.store.add({
      domain,
      version,
      wrappedKey: generated.wrapped,
      createdAt: this.now(),
      retiredAt: null,
    });
    this.cache.set(cacheKey(domain, version), generated.plaintext);
    return version;
  }

  private async ensureCurrentVersion(domain: DataDomain): Promise<number> {
    const current = await this.store.current(domain);
    return current ? current.version : this.rotate(domain);
  }

  private async dataKey(domain: DataDomain, version: number): Promise<Buffer> {
    const cached = this.cache.get(cacheKey(domain, version));
    if (cached) {
      return cached;
    }
    const record = await this.store.get(domain, version);
    if (!record) {
      throw new DecryptionError();
    }
    const key = await this.keys.decryptDataKey(domain, record.wrappedKey);
    this.cache.set(cacheKey(domain, version), key);
    return key;
  }
}

function aad(domain: DataDomain, version: number): Buffer {
  return Buffer.from(`${domain}:${String(version)}`, 'utf8');
}

function cacheKey(domain: DataDomain, version: number): string {
  return `${domain}:${String(version)}`;
}
