import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module.js';
import { SearchController } from './search.controller.js';
import { SearchRepository } from './search.repository.js';
import { SearchService } from './search.service.js';

/** Public search, profiles and slots (Step 4: SD, PO-05). */
@Module({
  imports: [AvailabilityModule],
  controllers: [SearchController],
  providers: [SearchRepository, SearchService],
  exports: [SearchRepository],
})
export class SearchModule {}
