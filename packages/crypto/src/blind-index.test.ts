import { randomBytes } from 'node:crypto';
import { BlindIndexer, deriveBlindIndexKeys } from './blind-index.js';

const keys = {
  health: randomBytes(32),
  identity: randomBytes(32),
  payments: randomBytes(32),
  documents: randomBytes(32),
};

describe('BlindIndexer', () => {
  it('EN-09.1 produces an HMAC-SHA-256 hex digest, never the plaintext', () => {
    const value = '9000000001';
    const index = new BlindIndexer(keys).index('identity', value);
    expect(index).toMatch(/^[0-9a-f]{64}$/);
    expect(index).not.toContain(value);
  });

  it('EN-09.1 is stable after normalisation and differs per domain', () => {
    const indexer = new BlindIndexer(keys);
    expect(indexer.index('identity', ' A@x.test ')).toBe(indexer.index('identity', 'a@x.test'));
    expect(indexer.index('identity', 'a@x.test')).not.toBe(indexer.index('health', 'a@x.test'));
  });

  it('refuses a short key', () => {
    expect(() =>
      new BlindIndexer({ ...keys, health: Buffer.alloc(8) }).index('health', 'x'),
    ).toThrow();
  });
});

describe('deriveBlindIndexKeys', () => {
  it('EN-09.1 derives a distinct 32-byte key per domain, stable for one root key', () => {
    const root = randomBytes(32);
    const derived = deriveBlindIndexKeys(root);
    expect(new Set(Object.values(derived).map((k) => k.toString('hex'))).size).toBe(4);
    expect(deriveBlindIndexKeys(root).health.equals(derived.health)).toBe(true);
  });
});
