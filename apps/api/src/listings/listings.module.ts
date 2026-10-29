import { Module } from '@nestjs/common';
import { CatalogueModule } from '../catalogue/catalogue.module.js';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
import { ListingsController } from './listings.controller.js';
import { ListingsRepository } from './listings.repository.js';

/** Provider listings and service areas (SL-02 to SL-07). */
@Module({
  imports: [CatalogueModule, OnboardingModule],
  controllers: [ListingsController],
  providers: [ListingsRepository],
  exports: [ListingsRepository],
})
export class ListingsModule {}
