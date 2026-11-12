import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module.js';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
import { OtpModule } from '../otp/otp.module.js';
import { AssistedActionsController } from './assisted-actions.controller.js';
import { AssistedActionsService } from './assisted-actions.service.js';
import { AssistedConsentService } from './assisted-consent.service.js';
import { AssistedDetailsService } from './assisted-details.service.js';
import { AssistedPayoutService } from './assisted-payout.service.js';
import { AssistedSessionRepository } from './assisted-session.repository.js';
import { AssistedSessionsController } from './assisted-sessions.controller.js';
import { AssistedSessions } from './assisted-sessions.js';

/** Assisted onboarding (AD-12): a support admin sets up a provider with the provider's OTP consent. */
@Module({
  imports: [AccountsModule, OnboardingModule, OtpModule],
  controllers: [AssistedSessionsController, AssistedActionsController],
  providers: [
    AssistedSessionRepository,
    AssistedSessions,
    AssistedConsentService,
    AssistedDetailsService,
    AssistedActionsService,
    AssistedPayoutService,
  ],
})
export class AssistedOnboardingModule {}
