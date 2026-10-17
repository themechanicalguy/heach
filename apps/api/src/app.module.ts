import { type DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from './audit/audit.module.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from './config/config.module.js';
import type { AppEnv } from './config/env.schema.js';
import { CryptoModule } from './crypto/crypto.module.js';
import { DataStoresModule } from './data-stores/data-stores.module.js';
import { FlagsModule } from './flags/flags.module.js';
import { HealthController } from './health/health.controller.js';
import { ReadinessService } from './health/readiness.service.js';
import { SampleNotesModule } from './sample-notes/sample-notes.module.js';
import { SecurityModule } from './security/security.module.js';
import { UserThrottlerGuard } from './security/user-throttler.guard.js';

/** Guards run in this order: rate limit first, then authentication and roles (SE-02.1). */
@Module({})
export class AppModule {
  static forEnv(appEnv: AppEnv): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule,
        DataStoresModule,
        CryptoModule,
        AuditModule,
        FlagsModule,
        SecurityModule,
        AuthModule.register(appEnv),
        SampleNotesModule,
      ],
      controllers: [HealthController],
      providers: [
        ReadinessService,
        { provide: APP_GUARD, useClass: UserThrottlerGuard },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    };
  }
}
