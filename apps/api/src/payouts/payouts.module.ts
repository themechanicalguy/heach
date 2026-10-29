import { Global, Module } from '@nestjs/common';
import { LedgerService } from './ledger.service.js';
import { EarningsController, FinanceController } from './payouts.controller.js';

/** Earnings ledger, weekly payouts and finance (PY-04, PY-05, AD-07). */
@Global()
@Module({
  controllers: [EarningsController, FinanceController],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class PayoutsModule {}
