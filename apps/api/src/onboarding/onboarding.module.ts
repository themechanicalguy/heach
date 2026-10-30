import { Module } from '@nestjs/common';
import { ApplicationView } from './application-view.js';
import { ChecklistSettings } from './checklist-settings.js';
import { AdminChecklistsController } from './checklists.controller.js';
import { OnboardingController } from './onboarding.controller.js';
import { OnboardingRepository } from './onboarding.repository.js';
import { OnboardingService } from './onboarding.service.js';
import { ProviderAccess } from './provider-access.js';
import { VerificationController } from './verification.controller.js';
import { VerificationService } from './verification.service.js';

/** Provider onboarding and the admin verification queue (Step 3: J1, J5). */
@Module({
  controllers: [OnboardingController, VerificationController, AdminChecklistsController],
  providers: [
    OnboardingRepository,
    ApplicationView,
    ChecklistSettings,
    OnboardingService,
    VerificationService,
    ProviderAccess,
  ],
  exports: [OnboardingRepository, ProviderAccess],
})
export class OnboardingModule {}
