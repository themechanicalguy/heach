import { Module } from '@nestjs/common';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
import { AvailabilityController } from './availability.controller.js';
import { AvailabilityRepository } from './availability.repository.js';
import { SlotLocks } from './slot-locks.js';
import { SlotService } from './slot.service.js';

/** Provider availability, slot generation and checkout holds (AV-01 to AV-04). */
@Module({
  imports: [OnboardingModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityRepository, SlotLocks, SlotService],
  exports: [AvailabilityRepository, SlotLocks, SlotService],
})
export class AvailabilityModule {}
