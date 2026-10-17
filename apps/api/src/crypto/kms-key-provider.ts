import { DecryptCommand, GenerateDataKeyCommand, type KMSClient } from '@aws-sdk/client-kms';
import type { DataDomain, GeneratedDataKey, KeyProvider } from '@heach/crypto';

/**
 * AWS KMS adapter (EN-04): one customer managed key per domain, named `<prefix>-<domain>`.
 * The domain is bound as encryption context, so a wrapped key cannot be unwrapped as another
 * domain's (EN-06). The master key never leaves KMS; the API role may call only these two
 * operations (EN-04.2).
 */
export class KmsKeyProvider implements KeyProvider {
  constructor(
    private readonly kms: Pick<KMSClient, 'send'>,
    private readonly aliasPrefix: string,
  ) {}

  async generateDataKey(domain: DataDomain): Promise<GeneratedDataKey> {
    const result = await this.kms.send(
      new GenerateDataKeyCommand({
        KeyId: `${this.aliasPrefix}-${domain}`,
        KeySpec: 'AES_256',
        EncryptionContext: { domain },
      }),
    );
    if (!result.Plaintext || !result.CiphertextBlob) {
      throw new Error('KMS returned no data key');
    }
    return {
      plaintext: Buffer.from(result.Plaintext),
      wrapped: Buffer.from(result.CiphertextBlob),
    };
  }

  async decryptDataKey(domain: DataDomain, wrapped: Buffer): Promise<Buffer> {
    const result = await this.kms.send(
      new DecryptCommand({
        KeyId: `${this.aliasPrefix}-${domain}`,
        CiphertextBlob: wrapped,
        EncryptionContext: { domain },
      }),
    );
    if (!result.Plaintext) {
      throw new Error('KMS returned no plaintext');
    }
    return Buffer.from(result.Plaintext);
  }
}
