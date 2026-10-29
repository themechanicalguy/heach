import { type DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AccountsModule } from './accounts/accounts.module.js';
import { AdaptersModule } from './adapters/adapters.module.js';
import { AdminModule } from './admin/admin.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from './config/config.module.js';
import type { AppEnv } from './config/env.schema.js';
import { CryptoModule } from './crypto/crypto.module.js';
import { DataStoresModule } from './data-stores/data-stores.module.js';
import { FlagsModule } from './flags/flags.module.js';
import { HealthController } from './health/health.controller.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { ObservabilityModule } from './observability/observability.module.js';
import { ReadinessService } from './health/readiness.service.js';
import { SampleNotesModule } from './sample-notes/sample-notes.module.js';
import { SecurityModule } from './security/security.module.js';
import { UserThrottlerGuard } from './security/user-throttler.guard.js';
import { UploadsModule } from './uploads/uploads.module.js';

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
        AdaptersModule,
        FlagsModule,
        SecurityModule,
        AuthModule.register(appEnv),
        ObservabilityModule,
        SampleNotesModule,
        AccountsModule,
        AdminModule,
        UploadsModule,
        NotificationsModule,
        OnboardingModule,
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
