import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../adapters/payments.port.js';
import { AuditService } from '../audit/audit.service.js';
import { reason } from '../common/error-response.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { withTransaction } from '../data-stores/transaction.js';
import { JobRunner } from '../jobs/runner/job-runner.js';
import { PaymentsRepository } from './payments.repository.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import type pg from 'pg';

export const REFUND_JOB = 'refund_process';

/**
 * Refunds to the original payment method (PY-02). A refund is planned in the same transaction as
 * the change that causes it, never more than what was paid (TS-09), and sent to the gateway after
 * commit; a failure stays pending and the job retries it.
 */
@Injectable()
export class RefundsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    private readonly payments: PaymentsRepository,
    private readonly jobs: JobRunner,
    private readonly audit: AuditService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  /** Plans `amountPaise` across the booking's paid payments; returns the amount planned. */
  async plan(
    client: TransactionClient,
    refund: { bookingId: string; amountPaise: number; reason: string; actorRole: string },
  ): Promise<number> {
    if (refund.amountPaise <= 0) return 0;
    const paid = (await this.payments.forBooking(refund.bookingId, client)).filter(
      (payment) => payment.status === 'paid',
    );
    const refundable = paid.reduce(
      (sum, payment) => sum + payment.amountPaise - payment.refundedPaise,
      0,
    );
    if (refund.amountPaise > refundable) throw reason(BadRequestException, 'refund_exceeds_paid');
    let left = refund.amountPaise;
    for (const payment of paid) {
      const share = Math.min(left, payment.amountPaise - payment.refundedPaise);
      if (share <= 0) continue;
      await this.payments.insertRefund(client, {
        ...refund,
        paymentId: payment.id,
        amountPaise: share,
      });
      left -= share;
    }
    await this.jobs.enqueue(client, { kind: REFUND_JOB, payload: { bookingId: refund.bookingId } });
    await this.audit.record(
      { action: 'refund.planned', entity: 'booking', entityId: refund.bookingId },
      client,
    );
    return refund.amountPaise;
  }

  /**
   * Sends pending refunds of one booking to the gateway; returns the total now processed and
   * calls `settled` inside the transaction that records them.
   */
  async process(
    bookingId: string,
    settled: (client: TransactionClient, paise: number) => Promise<void>,
  ): Promise<number> {
    return withTransaction(this.pool, async (client) => {
      const pending = await this.payments.lockPendingRefunds(client, bookingId);
      let total = 0;
      for (const refund of pending) {
        if (!refund.gatewayPaymentId) continue;
        // A network call inside the lock is deliberate: the row lock is what stops a double refund.
        const { refundId } = await this.gateway.refund({
          paymentId: refund.gatewayPaymentId,
          amountPaise: refund.amountPaise,
        });
        await this.payments.finishRefund(client, refund.id, refundId);
        total += refund.amountPaise;
      }
      if (total > 0) await settled(client, total);
      return total;
    });
  }
}
