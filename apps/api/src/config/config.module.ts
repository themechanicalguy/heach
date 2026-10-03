import { Global, Module } from '@nestjs/common';
import { EnvVars } from './env.schema.js';
import { validateEnv } from './env.validate.js';

/** Provides the validated EnvVars to every module. */
@Global()
@Module({
  providers: [{ provide: EnvVars, useFactory: () => validateEnv(process.env) }],
  exports: [EnvVars],
})
export class ConfigModule {}
