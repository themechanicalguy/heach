import { GetParametersCommand, type SSMClient } from '@aws-sdk/client-ssm';
import { loadSecrets } from './load-secrets.js';

function fakeSsm(names: string[], invalid: string[] = []): Pick<SSMClient, 'send'> {
  return {
    send: vi.fn().mockResolvedValue({
      Parameters: names.map((name) => ({ Name: `/heach/dev/${name}`, Value: `value-of-${name}` })),
      InvalidParameters: invalid,
    }),
  };
}

describe('loadSecrets', () => {
  it('EN-12.1 fills only the secrets this process needs from Parameter Store', async () => {
    const env: Record<string, string | undefined> = {
      SECRETS_SOURCE: 'ssm',
      SSM_PARAMETER_PATH: '/heach/dev',
    };
    await loadSecrets(
      env,
      undefined,
      fakeSsm(['DB_APP_PASSWORD', 'POSTGRES_PASSWORD', 'REDIS_PASSWORD', 'UNRELATED']),
    );
    expect(env.DATABASE_PASSWORD).toBe('value-of-DB_APP_PASSWORD');
    expect(env.REDIS_PASSWORD).toBe('value-of-REDIS_PASSWORD');
    expect(Object.values(env)).not.toContain('value-of-UNRELATED');
    expect(env.DATABASE_ADMIN_PASSWORD).toBeUndefined();
  });

  it('EN-12.1 asks Parameter Store by name for the wanted secrets only, never by path', async () => {
    const client = fakeSsm([]);
    await loadSecrets(
      { SECRETS_SOURCE: 'ssm', SSM_PARAMETER_PATH: '/heach/dev' },
      undefined,
      client,
    );
    const command = vi.mocked(client.send).mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(GetParametersCommand);
    expect((command as GetParametersCommand).input).toEqual({
      Names: [
        '/heach/dev/DB_APP_PASSWORD',
        '/heach/dev/REDIS_PASSWORD',
        '/heach/dev/BLIND_INDEX_KEY',
      ],
      WithDecryption: true,
    });
  });

  it('EN-12.1 fails start-up when a wanted parameter is missing', async () => {
    await expect(
      loadSecrets(
        { SECRETS_SOURCE: 'ssm', SSM_PARAMETER_PATH: '/heach/dev' },
        undefined,
        fakeSsm([], ['/heach/dev/REDIS_PASSWORD']),
      ),
    ).rejects.toThrow('Missing parameters: /heach/dev/REDIS_PASSWORD');
  });

  it('does nothing when the source is env', async () => {
    const client = fakeSsm([]);
    await loadSecrets({ SECRETS_SOURCE: 'env' }, undefined, client);
    expect(client.send).not.toHaveBeenCalled();
  });

  it('requires a parameter path', async () => {
    await expect(loadSecrets({ SECRETS_SOURCE: 'ssm' }, undefined, fakeSsm([]))).rejects.toThrow(
      /SSM_PARAMETER_PATH/,
    );
  });
});
