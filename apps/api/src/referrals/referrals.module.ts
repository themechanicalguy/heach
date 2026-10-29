import { Module } from '@nestjs/common';
import { AdminReferralsController, ReferralsController } from './referrals.controller.js';
import { ReferralsService } from './referrals.service.js';

/** Referrals and coupons (Step 9: RR, AD-16). */
@Module({
  controllers: [ReferralsController, AdminReferralsController],
  providers: [ReferralsService],
})
export class ReferralsModule {}
