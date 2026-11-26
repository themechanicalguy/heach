import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../adapters/payments.port.js';
import { AuditService } from '../audit/audit.service.js';
import { reason } from '../common/error-response.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { withTransaction } from '../data-stores/transaction.js';
import { JobRunner } from '../jobs/runner/job-runner.js';
import { PaymentsRepository, type RefundOwner } from './payments.repository.js';
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

  /** Sends a booking's pending refunds; see `drain`. */
  process(bookingId: string, settled: Settled): Promise<number> {
    return this.drain({ kind: 'booking', id: bookingId }, settled);
  }

  /** Sends a plan purchase's pending refunds; see `drain`. */
  processPurchase(purchaseId: string, settled: Settled): Promise<number> {
    return this.drain({ kind: 'purchase', id: purchaseId }, settled);
  }

  /**
   * Sends pending refunds one at a time, each in its own transaction under its row lock, with our
   * refund ID as the gateway's idempotency key. A gateway failure rolls back only the refund it
   * was sending: the ones already sent stay recorded and are never sent again (the job retries
   * the rest). Returns the total sent; `settled` runs in each refund's transaction.
   */
  private async drain(owner: RefundOwner, settled: Settled): Promise<number> {
    const tried: string[] = [];
    let total = 0;
    for (;;) {
      const sent = await withTransaction(this.pool, async (client) => {
        const refund = await this.payments.lockNextPendingRefund(client, owner, tried);
        if (!refund) return undefined;
        tried.push(refund.id);
        if (!refund.gatewayPaymentId) return 0;
        const { refundId } = await this.gateway.refund({
          paymentId: refund.gatewayPaymentId,
          amountPaise: refund.amountPaise,
          idempotencyKey: refund.id,
        });
        await this.payments.finishRefund(client, refund.id, refundId);
        await settled(client, refund.amountPaise);
        return refund.amountPaise;
      });
      if (sent === undefined) return total;
      total += sent;
    }
  }
}

type Settled = (client: TransactionClient, paise: number) => Promise<void>;
