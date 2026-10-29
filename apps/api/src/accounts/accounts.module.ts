import { Module } from '@nestjs/common';
import { LinkedPatientsModule } from '../linked-patients/linked-patients.module.js';
import { OrganisationsModule } from '../organisations/organisations.module.js';
import { OtpModule } from '../otp/otp.module.js';
import { AccountDataController } from './account-data.controller.js';
import { AccountDataService } from './account-data.service.js';
import { AccountRepository } from './account.repository.js';
import { AccountsService } from './accounts.service.js';
import { MeController } from './me.controller.js';
import { MobileChangeService } from './mobile-change.service.js';
import { SignInController } from './sign-in.controller.js';
import { TestLoginController } from './test-login.controller.js';

/**
 * Patient and provider accounts: OTP sign-in, setup, consent, roles, the holder's data rights and
 * number change (AC, PR-01, PR-04).
 */
@Module({
  imports: [OtpModule, OrganisationsModule, LinkedPatientsModule],
  controllers: [SignInController, MeController, AccountDataController, TestLoginController],
  providers: [AccountRepository, AccountsService, AccountDataService, MobileChangeService],
  exports: [AccountRepository],
})
export class AccountsModule {}
