import { Module } from '@nestjs/common';
import { OtpModule } from '../otp/otp.module.js';
import { AccountRepository } from './account.repository.js';
import { AccountsService } from './accounts.service.js';
import { MeController } from './me.controller.js';
import { SignInController } from './sign-in.controller.js';
import { TestLoginController } from './test-login.controller.js';

/** Patient and provider accounts: OTP sign-in, setup, consent and roles (AC, PR-01). */
@Module({
  imports: [OtpModule],
  controllers: [SignInController, MeController, TestLoginController],
  providers: [AccountRepository, AccountsService],
  exports: [AccountRepository],
})
export class AccountsModule {}
