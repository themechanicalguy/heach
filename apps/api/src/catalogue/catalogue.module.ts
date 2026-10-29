import { Module } from '@nestjs/common';
import { CatalogueAdminController, CatalogueController } from './catalogue.controller.js';
import { CatalogueRepository } from './catalogue.repository.js';

/** The service catalogue and serviceable PIN codes (Step 4). */
@Module({
  controllers: [CatalogueController, CatalogueAdminController],
  providers: [CatalogueRepository],
  exports: [CatalogueRepository],
})
export class CatalogueModule {}
