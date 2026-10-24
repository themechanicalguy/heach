import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';

/** Parameter names under SSM_PARAMETER_PATH, and the variable each one fills. */
const SECRET_PARAMETERS = {
  POSTGRES_PASSWORD: 'DATABASE_ADMIN_PASSWORD',
  DB_APP_PASSWORD: 'DATABASE_PASSWORD',
  DB_MIGRATOR_PASSWORD: 'DATABASE_MIGRATOR_PASSWORD',
  REDIS_PASSWORD: 'REDIS_PASSWORD',
  BLIND_INDEX_KEY: 'BLIND_INDEX_KEY',
  TEST_LOGIN_KEY: 'TEST_LOGIN_KEY',
} as const;

export type SecretName = keyof typeof SECRET_PARAMETERS;

/**
 * What the API process itself needs; the admin and migrator passwords stay out of it. The API's
 * IAM role may read exactly these parameters (infra/envs/dev/main.tf `api_parameter_names`).
 */
export const API_SECRETS: readonly SecretName[] = [
  'DB_APP_PASSWORD',
  'REDIS_PASSWORD',
  'BLIND_INDEX_KEY',
];

/** The API's secrets in one environment: the dev host adds its test sign-in key (SE-07.23). */
export function apiSecrets(appEnv: string | undefined): readonly SecretName[] {
  return appEnv === 'dev' ? [...API_SECRETS, 'TEST_LOGIN_KEY'] : API_SECRETS;
}

type ParameterReader = Pick<SSMClient, 'send'>;

/**
 * When SECRETS_SOURCE is `ssm`, reads SecureString parameters at start-up and puts them in
 * `env` (EN-12.1), so no secret is in the image, the Compose file or the deploy environment.
 * Only the `wanted` names are read (least privilege per process); values are never logged.
 */
export async function loadSecrets(
  env: Record<string, string | undefined>,
  wanted: readonly SecretName[] = API_SECRETS,
  client: ParameterReader = new SSMClient({}),
): Promise<void> {
  if (env.SECRETS_SOURCE !== 'ssm') {
    return;
  }
  const path = env.SSM_PARAMETER_PATH;
  if (!path) {
    throw new Error('SSM_PARAMETER_PATH is required when SECRETS_SOURCE is ssm');
  }
  // By name, not by path: the process asks only for what it needs, and the host policy grants
  // `parameter<path>/*`, which a by-path read (authorised on the path itself) does not match.
  const names = wanted.map((name) => `${path}/${name}`);
  const { Parameters = [], InvalidParameters = [] } = await client.send(
    new GetParametersCommand({ Names: names, WithDecryption: true }),
  );
  if (InvalidParameters.length > 0) {
    throw new Error(`Missing parameters: ${InvalidParameters.join(', ')}`);
  }
  for (const parameter of Parameters) {
    const name = parameter.Name?.slice(path.length + 1) as SecretName | undefined;
    if (name && wanted.includes(name) && parameter.Value) {
      env[SECRET_PARAMETERS[name]] = parameter.Value;
    }
  }
}
