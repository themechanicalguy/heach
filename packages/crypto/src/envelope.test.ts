import { InMemoryDataKeyStore } from './data-key-store.js';
import { DecryptionError, EnvelopeEncryptor } from './envelope.js';
import { LocalKeyProvider } from './key-provider.js';

function setup() {
  const keys = new LocalKeyProvider();
  const store = new InMemoryDataKeyStore();
  return { keys, store, encryptor: new EnvelopeEncryptor(keys, store) };
}

describe('EnvelopeEncryptor', () => {
  it('EN-03.1 stores ciphertext only and round-trips Odia text', async () => {
    const { encryptor } = setup();
    const note = 'ମୋର ମୁଣ୍ଡ ବିନ୍ଧୁଛି';
    const field = await encryptor.encrypt(note, 'health');
    expect(field.ciphertext).not.toContain(note);
    expect(Buffer.from(field.ciphertext, 'base64').toString('utf8')).not.toContain(note);
    expect(await encryptor.decrypt(field)).toBe(note);
  });

  it('EN-03.2 raises and returns nothing when the auth tag is altered', async () => {
    const { encryptor } = setup();
    const field = await encryptor.encrypt('synthetic', 'health');
    const raw = Buffer.from(field.ciphertext, 'base64');
    raw[12] = (raw[12] ?? 0) ^ 0xff;
    const tampered = { ...field, ciphertext: raw.toString('base64') };
    await expect(encryptor.decrypt(tampered)).rejects.toBeInstanceOf(DecryptionError);
  });

  it('EN-04.1 uses a KMS data key with AES-256-GCM and stores only the wrapped key', async () => {
    const { encryptor, keys, store } = setup();
    const field = await encryptor.encrypt('synthetic', 'health');
    expect(field.algorithm).toBe('AES-256-GCM');
    expect(keys.calls).toEqual([{ op: 'generate', domain: 'health' }]);
    const record = await store.current('health');
    expect(record?.wrappedKey.length).toBeGreaterThan(32);
    expect(Object.keys(record ?? {})).not.toContain('plaintext');
  });

  it('EN-05.1 keeps version 1 values readable after rotating to version 2', async () => {
    const { encryptor } = setup();
    const old = await encryptor.encrypt('before', 'health');
    expect(await encryptor.rotate('health')).toBe(2);
    const fresh = await encryptor.encrypt('after', 'health');
    expect([old.keyVersion, fresh.keyVersion]).toEqual(['1', '2']);
    expect(await encryptor.decrypt(old)).toBe('before');
  });

  it('EN-05.1 unwraps an old key through KMS after a restart', async () => {
    const { keys, store, encryptor } = setup();
    const field = await encryptor.encrypt('persisted', 'health');
    const restarted = new EnvelopeEncryptor(keys, store);
    expect(await restarted.decrypt(field)).toBe('persisted');
    expect(keys.calls.at(-1)).toEqual({ op: 'decrypt', domain: 'health' });
  });

  it('EN-06.1 fails to decrypt a health value with the identity key', async () => {
    const { encryptor } = setup();
    await encryptor.encrypt('identity value', 'identity');
    const field = await encryptor.encrypt('health value', 'health');
    await expect(encryptor.decrypt({ ...field, domain: 'identity' })).rejects.toBeInstanceOf(
      DecryptionError,
    );
  });

  it('rejects unknown algorithms and versions', async () => {
    const { encryptor } = setup();
    const field = await encryptor.encrypt('x', 'health');
    await expect(encryptor.decrypt({ ...field, algorithm: 'none' })).rejects.toBeInstanceOf(
      DecryptionError,
    );
    await expect(encryptor.decrypt({ ...field, keyVersion: '9' })).rejects.toBeInstanceOf(
      DecryptionError,
    );
  });
});
