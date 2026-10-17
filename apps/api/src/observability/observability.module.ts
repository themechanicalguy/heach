import { Global, Module } from '@nestjs/common';
import { ALERT_PUBLISHER, type AlertPublisher } from '../security/alert-publisher.js';
import { ErrorRateMonitor } from './error-rate.monitor.js';
import { RumController } from './rum.controller.js';

@Global()
@Module({
  controllers: [RumController],
  providers: [
    {
      provide: ErrorRateMonitor,
      inject: [ALERT_PUBLISHER],
      useFactory: (alerts: AlertPublisher) => new ErrorRateMonitor(alerts),
    },
  ],
  exports: [ErrorRateMonitor],
})
export class ObservabilityModule {}
