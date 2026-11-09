import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module.js';
import { CoverageCacheModule } from './coverage-cache.module.js';
import { CoveragePinsService } from './coverage-pins.service.js';
import { CoverageController } from './coverage.controller.js';
import { SearchController } from './search.controller.js';
import { SearchRepository } from './search.repository.js';
import { SearchService } from './search.service.js';

/** Public search, profiles and slots (Step 4: SD, PO-05). */
@Module({
  imports: [AvailabilityModule, CoverageCacheModule],
  controllers: [SearchController, CoverageController],
  providers: [SearchRepository, SearchService, CoveragePinsService],
  exports: [SearchRepository],
})
export class SearchModule {}
