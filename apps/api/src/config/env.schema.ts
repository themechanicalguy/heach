import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/** Every environment variable the API reads. Add new ones here so they are validated at startup. */
export class EnvVars {
  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT!: number;

  @IsOptional()
  @IsString()
  BUILD_VERSION?: string;

  /** postgresql:// URL. Staging and production must require TLS (EN-01). */
  @Matches(/^postgres(ql)?:\/\//)
  DATABASE_URL!: string;

  /** redis:// (local) or rediss:// (TLS, staging and production). */
  @Matches(/^rediss?:\/\//)
  REDIS_URL!: string;
}
