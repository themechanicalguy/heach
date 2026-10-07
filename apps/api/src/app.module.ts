import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { DataStoresModule } from './data-stores/data-stores.module.js';
import { HealthController } from './health/health.controller.js';
import { ReadinessService } from './health/readiness.service.js';

@Module({
  imports: [ConfigModule, DataStoresModule],
  controllers: [HealthController],
  providers: [ReadinessService],
})
export class AppModule {}
