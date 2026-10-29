import { APP_ENVS, type AppEnv } from '@heach/flags';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
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

  /**
   * Key the test sign-in requires; on the dev host only the loopback-only proxy entry sends it
   * (SE-07.23). Without it, test sign-in is refused in dev and open in local and test.
   */
  @ValidateIf((env: EnvVars) => !!env.TEST_LOGIN_KEY) // empty, as Compose passes it, means unset
  @IsString()
  @MinLength(32)
  TEST_LOGIN_KEY?: string;

  /** Comma-separated server feature flags switched on in this environment (FF-01.1). */
  @IsOptional()
  @IsString()
  FEATURE_FLAGS?: string;

  /** Requests per window per signed-in user, on top of the address limit (SO-08.1). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  RATE_LIMIT_PER_MINUTE = 120;

  /** Requests per window per client address, whatever the credentials (SO-08.12). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  RATE_LIMIT_PER_ADDRESS_PER_MINUTE = 200;

  /** Length of the rate-limit window; tests shorten it to prove recovery (SO-08.9). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  RATE_LIMIT_WINDOW_SECONDS = 60;

  /**
   * `fake` keeps SMS in memory (tests); `local` delivers them to the Mailpit inbox (local and test
   * only). No real SMS provider exists until DLT registration (#20, decision L-8).
   */
  @IsIn(['fake', 'local'])
  SMS_PROVIDER: 'fake' | 'local' = 'fake';

  /** Run due jobs inside the API process (local development); hosts run `job:worker`. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  JOBS_IN_PROCESS = false;

  /** The web app's origin, for links partners send people back to (identity, payments). */
  @Matches(/^https?:\/\/[\w.-]+(:\d+)?$/)
  WEB_ORIGIN = 'http://localhost:3000';

  /** Mailpit's HTTP API, for SMS_PROVIDER=local. */
  @Matches(/^https?:\/\/[\w.-]+(:\d+)?$/)
  MAILPIT_API_URL = 'http://localhost:8025';

  /** OTP sends per mobile number per hour and per day (SE-08, decision L-6). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  OTP_SENDS_PER_NUMBER_PER_HOUR = 5;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  OTP_SENDS_PER_NUMBER_PER_DAY = 10;

  /** OTP sends per device cookie per hour. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  OTP_SENDS_PER_DEVICE_PER_HOUR = 10;

  /** OTP sends, and wrong codes, per client address per hour. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  OTP_SENDS_PER_ADDRESS_PER_HOUR = 30;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  OTP_FAILURES_PER_ADDRESS_PER_HOUR = 30;

  /** SNS topic for alerts (D5); unset means alerts are logged only. */
  @IsOptional()
  @Matches(/^arn:aws:sns:ap-south-1:\d{12}:[\w-]+$/)
  ALERT_TOPIC_ARN?: string;
}
