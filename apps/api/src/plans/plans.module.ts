import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module.js';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
import {
  AdminPlansController,
  PlansController,
  ProviderPlansController,
} from './plans.controller.js';
import { PlansService } from './plans.service.js';

/** Care packages, subscriptions and the entitlement ledger (Step 9: J8, PK, AD-14). */
@Module({
  imports: [BookingsModule, OnboardingModule],
  controllers: [PlansController, ProviderPlansController, AdminPlansController],
  providers: [PlansService],
})
export class PlansModule {}
