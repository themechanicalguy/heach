import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module.js';
import { VisitCodes } from './visit-codes.js';
import { PatientVisitsController, ProviderVisitsController } from './visits.controller.js';
import { VisitsRepository } from './visits.repository.js';
import { VisitsService } from './visits.service.js';

/** The home visit and attendant shifts (Step 6: HS-03 to HS-05, A12, A15). */
@Module({
  imports: [BookingsModule],
  controllers: [PatientVisitsController, ProviderVisitsController],
  providers: [VisitCodes, VisitsRepository, VisitsService],
  exports: [VisitsRepository, VisitCodes],
})
export class VisitsModule {}
