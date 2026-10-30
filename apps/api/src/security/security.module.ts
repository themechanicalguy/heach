import { SNSClient } from '@aws-sdk/client-sns';
import { Global, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { EnvVars } from '../config/env.schema.js';
import { ALERT_PUBLISHER, LogAlertPublisher, SnsAlertPublisher } from './alert-publisher.js';
import { AuthzFailureMonitor } from './authz-failure.monitor.js';
import { UnusualReadMonitor } from './unusual-read.monitor.js';
import { ADDRESS_THROTTLER, USER_THROTTLER } from './user-throttler.guard.js';

/** Rate limits per address and per user (SO-08.1, SO-08.12) and security alerts (SO-08.3, AD-17). */
@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [EnvVars],
      useFactory: (env: EnvVars) => {
        const ttl = env.RATE_LIMIT_WINDOW_SECONDS * 1000;
        return [
          { name: ADDRESS_THROTTLER, ttl, limit: env.RATE_LIMIT_PER_ADDRESS_PER_MINUTE },
          { name: USER_THROTTLER, ttl, limit: env.RATE_LIMIT_PER_MINUTE },
        ];
      },
    }),
  ],
  providers: [
    {
      provide: ALERT_PUBLISHER,
      inject: [EnvVars],
      useFactory: (env: EnvVars) =>
        env.ALERT_TOPIC_ARN
          ? new SnsAlertPublisher(new SNSClient({}), env.ALERT_TOPIC_ARN)
          : new LogAlertPublisher(),
    },
    AuthzFailureMonitor,
    UnusualReadMonitor,
  ],
  exports: [ALERT_PUBLISHER, AuthzFailureMonitor, UnusualReadMonitor],
})
export class SecurityModule {}
