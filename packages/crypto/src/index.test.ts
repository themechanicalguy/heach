import { isEncryptedField } from './index.js';

describe('isEncryptedField', () => {
  const valid = { ciphertext: 'AAAA', keyVersion: 'v1', algorithm: 'x', domain: 'health' };

  it('accepts a complete encrypted field', () => {
    expect(isEncryptedField(valid)).toBe(true);
  });

  it('rejects plaintext, partial objects and unknown domains', () => {
    expect(isEncryptedField('plain text')).toBe(false);
    expect(isEncryptedField(null)).toBe(false);
    expect(isEncryptedField({ ...valid, keyVersion: undefined })).toBe(false);
    expect(isEncryptedField({ ...valid, domain: 'marketing' })).toBe(false);
  });
});
