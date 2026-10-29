import { Global, Module } from '@nestjs/common';
import { PaymentsRepository } from './payments.repository.js';
import { RefundsService } from './refunds.service.js';

/** Payments and refunds through the gateway port (PY-01, PY-02, PY-07). */
@Global()
@Module({
  providers: [PaymentsRepository, RefundsService],
  exports: [PaymentsRepository, RefundsService],
})
export class PaymentsModule {}
