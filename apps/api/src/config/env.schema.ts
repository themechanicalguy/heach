import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
}
