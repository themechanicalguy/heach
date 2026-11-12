import { Module } from '@nestjs/common';
import { CoverageCacheModule } from '../search/coverage-cache.module.js';
import { ApplicationGate } from './application-gate.js';
import { ApplicationView } from './application-view.js';
import { ChecklistSettings } from './checklist-settings.js';
import { AdminChecklistsController } from './checklists.controller.js';
import { IdentityService } from './identity.service.js';
import { OnboardingController } from './onboarding.controller.js';
import { OnboardingRepository } from './onboarding.repository.js';
import { OnboardingService } from './onboarding.service.js';
import { ProfileController } from './profile.controller.js';
import { ProfileRepository } from './profile.repository.js';
import { ProfileService } from './profile.service.js';
import { ProviderAccess } from './provider-access.js';
import { SharedDocumentsService } from './shared-documents.service.js';
import { VerificationController } from './verification.controller.js';
import { VerificationService } from './verification.service.js';

/** Provider onboarding and the admin verification queue (Step 3: J1, J5). */
@Module({
  imports: [CoverageCacheModule],
  controllers: [
    OnboardingController,
    ProfileController,
    VerificationController,
    AdminChecklistsController,
  ],
  providers: [
    OnboardingRepository,
    ApplicationGate,
    ApplicationView,
    IdentityService,
    ProfileRepository,
    ProfileService,
    SharedDocumentsService,
    ChecklistSettings,
    OnboardingService,
    VerificationService,
    ProviderAccess,
  ],
  exports: [
    OnboardingRepository,
    OnboardingService,
    IdentityService,
    ApplicationGate,
    ProviderAccess,
    ProfileService,
  ],
})
export class OnboardingModule {}
