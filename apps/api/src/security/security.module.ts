import { SNSClient } from '@aws-sdk/client-sns';
import { Global, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { EnvVars } from '../config/env.schema.js';
import { ALERT_PUBLISHER, LogAlertPublisher, SnsAlertPublisher } from './alert-publisher.js';
import { AuthzFailureMonitor } from './authz-failure.monitor.js';

/** Rate limits (SO-08.1) and security alerts (SO-08.3). */
@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [EnvVars],
      useFactory: (env: EnvVars) => [{ ttl: 60_000, limit: env.RATE_LIMIT_PER_MINUTE }],
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
  ],
  exports: [ALERT_PUBLISHER, AuthzFailureMonitor],
})
export class SecurityModule {}
