import { DecryptCommand, GenerateDataKeyCommand } from '@aws-sdk/client-kms';
import { KmsKeyProvider } from './kms-key-provider.js';

describe('KmsKeyProvider', () => {
  it('EN-04.1 asks KMS for an AES-256 data key on the domain alias with the domain as context', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ Plaintext: new Uint8Array(32), CiphertextBlob: new Uint8Array(64) });
    const provider = new KmsKeyProvider({ send }, 'alias/heach-dev');

    const key = await provider.generateDataKey('health');

    const command = send.mock.calls[0]?.[0] as GenerateDataKeyCommand;
    expect(command).toBeInstanceOf(GenerateDataKeyCommand);
    expect(command.input).toEqual({
      KeyId: 'alias/heach-dev-health',
      KeySpec: 'AES_256',
      EncryptionContext: { domain: 'health' },
    });
    expect(key.wrapped).toHaveLength(64);
  });

  it('EN-06.1 decrypts with the same domain alias and context', async () => {
    const send = vi.fn().mockResolvedValue({ Plaintext: new Uint8Array(32) });
    const provider = new KmsKeyProvider({ send }, 'alias/heach-dev');

    await provider.decryptDataKey('identity', Buffer.alloc(64));

    const command = send.mock.calls[0]?.[0] as DecryptCommand;
    expect(command).toBeInstanceOf(DecryptCommand);
    expect(command.input.KeyId).toBe('alias/heach-dev-identity');
    expect(command.input.EncryptionContext).toEqual({ domain: 'identity' });
  });
});
