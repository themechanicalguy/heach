import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module.js';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
import { AdminBookingsController } from './admin-bookings.controller.js';
import { BookingEffects } from './booking-effects.js';
import { BookingLifecycle } from './booking-lifecycle.js';
import { BookingRepository } from './booking.repository.js';
import { BookingTimers } from './booking-timers.js';
import { BookingViews } from './booking-views.js';
import {
  AnySlotsController,
  BookingPolicyController,
  BookingsController,
} from './bookings.controller.js';
import { CancellationService } from './cancellation.service.js';
import { CheckoutService } from './checkout.service.js';
import { DispatchRepository } from './dispatch.repository.js';
import { DispatchService } from './dispatch.service.js';
import { PaymentEventsService } from './payment-events.service.js';
import { PaymentsController } from './payments.controller.js';
import { ProviderBookingsController } from './provider-bookings.controller.js';

/** Booking, checkout, acceptance and the booking timers (Step 5: J3 and J4 to confirmation). */
@Module({
  imports: [AvailabilityModule, OnboardingModule],
  controllers: [
    BookingsController,
    AnySlotsController,
    BookingPolicyController,
    PaymentsController,
    ProviderBookingsController,
    AdminBookingsController,
  ],
  providers: [
    BookingRepository,
    DispatchRepository,
    BookingLifecycle,
    BookingEffects,
    CancellationService,
    CheckoutService,
    DispatchService,
    PaymentEventsService,
    BookingTimers,
    BookingViews,
  ],
  exports: [
    BookingRepository,
    BookingLifecycle,
    BookingEffects,
    CancellationService,
    BookingViews,
    DispatchRepository,
  ],
})
export class BookingsModule {}
