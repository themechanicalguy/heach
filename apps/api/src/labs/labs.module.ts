import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module.js';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
import { VisitsModule } from '../visits/visits.module.js';
import {
  AdminLabsController,
  CollectionsController,
  LabController,
  PatientLabController,
} from './labs.controller.js';
import { LabsService } from './labs.service.js';

/** Lab tests after booking (Step 7: J7, LB-05 to LB-11, AD-13). */
@Module({
  imports: [BookingsModule, VisitsModule, OnboardingModule],
  controllers: [PatientLabController, LabController, CollectionsController, AdminLabsController],
  providers: [LabsService],
})
export class LabsModule {}
