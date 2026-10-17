import { type CanActivate, Global, Injectable, Module, NotFoundException } from '@nestjs/common';
import { EnvVars } from '../config/env.schema.js';
import { FeatureFlags, type FlagName } from '@heach/flags';

@Global()
@Module({
  providers: [
    {
      provide: FeatureFlags,
      inject: [EnvVars],
      useFactory: (env: EnvVars) => new FeatureFlags(env.APP_ENV, env.FEATURE_FLAGS),
    },
  ],
  exports: [FeatureFlags],
})
export class FlagsModule {}

/** Guard factory: a route behind an off flag answers 404, as if it did not exist. */
export function requireFlag(flag: FlagName): new (flags: FeatureFlags) => CanActivate {
  @Injectable()
  class FlagGuard implements CanActivate {
    constructor(private readonly flags: FeatureFlags) {}

    canActivate(): boolean {
      if (!this.flags.isOn(flag)) {
        throw new NotFoundException();
      }
      return true;
    }
  }
  return FlagGuard;
}
