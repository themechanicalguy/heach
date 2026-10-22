import { APP_ENVS, type AppEnv } from '@heach/flags';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export { APP_ENVS, type AppEnv };

/** Every environment variable the API reads. Add new ones here so they are validated at startup. */
export class EnvVars {
  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;

  /** Deployment environment, separate from NODE_ENV: the dev host runs production builds. */
  @IsIn(APP_ENVS)
  APP_ENV!: AppEnv;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT!: number;

  @IsOptional()
  @IsString()
  BUILD_VERSION?: string;

  /** postgresql:// URL for the application role. TLS is always on (EN-01.1); see DATA_TLS_CA_FILE. */
  @Matches(/^postgres(ql)?:\/\/[^?]*$/, {
    message: 'no query string: TLS settings come from DATA_TLS_CA_FILE',
  })
  DATABASE_URL!: string;

  /** Overrides the password in DATABASE_URL; filled from Parameter Store on hosts (EN-12.1). */
  @IsOptional()
  @IsString()
  DATABASE_PASSWORD?: string;

  /** rediss:// only: plaintext Redis is refused (EN-01.1). */
  @Matches(/^rediss:\/\//)
  REDIS_URL!: string;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  /** PEM file of the CA that signed the PostgreSQL and Redis certificates. */
  @IsString()
  DATA_TLS_CA_FILE!: string;

  /** `ssm` reads secrets from Parameter Store at start-up (EN-12.1); `env` is local only. */
  @IsIn(['env', 'ssm'])
  SECRETS_SOURCE: 'env' | 'ssm' = 'env';

  @ValidateIf((env: EnvVars) => env.SECRETS_SOURCE === 'ssm')
  @Matches(/^\/[\w/-]+$/)
  SSM_PARAMETER_PATH?: string;

  /** `kms` on hosts; `local` (deterministic test double from LOCAL_KEY_SEED) in dev and test only. */
  @IsIn(['kms', 'local'])
  KEY_PROVIDER!: 'kms' | 'local';

  /** KMS alias prefix; the domain is appended, for example alias/heach-dev-health. */
  @ValidateIf((env: EnvVars) => env.KEY_PROVIDER === 'kms')
  @Matches(/^alias\/[\w-]+$/)
  KMS_ALIAS_PREFIX?: string;

  @ValidateIf((env: EnvVars) => env.KEY_PROVIDER === 'local')
  @IsString()
  @MinLength(32)
  LOCAL_KEY_SEED?: string;

  /** Hex HMAC key from which per-domain blind index keys are derived (EN-09.1). */
  @Matches(/^[0-9a-f]{64}$/)
  BLIND_INDEX_KEY!: string;

  /** Comma-separated server feature flags switched on in this environment (FF-01.1). */
  @IsOptional()
  @IsString()
  FEATURE_FLAGS?: string;

  /** Requests per minute per user, or per IP when signed out (SO-08.1). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  RATE_LIMIT_PER_MINUTE = 120;

  /** Length of the rate-limit window; tests shorten it to prove recovery (SO-08.9). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  RATE_LIMIT_WINDOW_SECONDS = 60;

  /** SNS topic for alerts (D5); unset means alerts are logged only. */
  @IsOptional()
  @Matches(/^arn:aws:sns:ap-south-1:\d{12}:[\w-]+$/)
  ALERT_TOPIC_ARN?: string;
}
