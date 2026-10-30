import { Module } from '@nestjs/common';
import { PayoutsModule } from '../payouts/payouts.module.js';
import { AdminReferralsController, ReferralsController } from './referrals.controller.js';
import { ReferralDevices } from './referral-device.js';
import { ReferralsService } from './referrals.service.js';

/** Referrals and coupons (Step 9: RR, AD-16); provider referrals earn commission back (RR-04). */
@Module({
  imports: [PayoutsModule],
  controllers: [ReferralsController, AdminReferralsController],
  providers: [ReferralsService, ReferralDevices],
})
export class ReferralsModule {}
