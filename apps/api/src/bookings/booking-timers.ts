import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../adapters/payments.port.js';
import { appLogger } from '../common/app-logger.js';
import { ALERT_PUBLISHER, type AlertPublisher } from '../security/alert-publisher.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import type pg from 'pg';
import { JobRunner } from '../jobs/runner/job-runner.js';
import { PaymentsRepository } from '../payments/payments.repository.js';
import { REFUND_JOB } from '../payments/refunds.service.js';
import { SYSTEM } from './booking-actor.js';
import { BookingEffects, noEffects } from './booking-effects.js';
import { BookingRepository } from './booking.repository.js';
import { CancellationService } from './cancellation.service.js';
import { PAYMENT_EXPIRY_JOB } from './checkout.service.js';
import { REMINDER_JOB } from './dispatch.service.js';

export const RECONCILE_JOB = 'payment_reconciliation';
const DAY_MS = 86_400_000;

/**
 * Booking timers on the job runner: unpaid checkouts expire, reminders go out 24 hours and 15
 * minutes before (BK-06), pending refunds retry, and payments reconcile daily against the
 * gateway with an alert on any mismatch (LM-06, LM-07).
 */
@Injectable()
export class BookingTimers implements OnModuleInit {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly payments: PaymentsRepository,
    private readonly cancellation: CancellationService,
    private readonly effects: BookingEffects,
    private readonly jobs: JobRunner,
    @Inject(ALERT_PUBLISHER) private readonly alerts: AlertPublisher,
    @Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  onModuleInit(): void {
    this.jobs.register(PAYMENT_EXPIRY_JOB, (payload) => this.expire(payload.bookingId ?? ''));
    this.jobs.register(REMINDER_JOB, (payload) => this.remind(payload.bookingId ?? ''));
    this.jobs.register(REFUND_JOB, async (payload) => {
      await this.effects.settleRefunds(payload.bookingId ?? '');
    });
    this.jobs.register(RECONCILE_JOB, async (_payload, now) => {
      await this.reconcile(now);
    });
  }

  async expire(bookingId: string): Promise<void> {
    const effects = await this.bookings.transaction(async (client) => {
      const booking = await this.bookings.lock(client, bookingId);
      if (booking?.status !== 'pending_payment') return noEffects();
      const result = await this.cancellation.cancel(client, booking, SYSTEM, 'payment_timeout', {
        event: 'expire',
        refundPaise: 0,
      });
      if (booking.providerId)
        result.releaseHolds.push({
          providerId: booking.providerId,
          start: booking.startsAt,
          holder: booking.bookerId,
        });
      return result;
    });
    await this.effects.run(effects);
  }

  async remind(bookingId: string): Promise<void> {
    const booking = await this.bookings.find(bookingId);
    if (booking?.status !== 'confirmed') return;
    const params = { time: booking.startsAt.toISOString() };
    const messages = [
      { to: booking.bookerId, template: 'booking_reminder' as const, params, bookingId },
    ];
    if (booking.providerId)
      messages.push({ to: booking.providerId, template: 'booking_reminder', params, bookingId });
    await this.effects.run({ ...noEffects(), messages });
  }

  /** Compares the previous day's paid payments with the gateway; returns the mismatches. */
  async reconcile(now: Date): Promise<number> {
    const paid = await this.payments.paidBetween(new Date(now.getTime() - DAY_MS), now);
    let mismatches = 0;
    for (const payment of paid) {
      const order = await this.gateway.orderStatus(payment.orderId);
      if (!order?.paid || order.amountPaise !== payment.amountPaise) mismatches += 1;
    }
    if (mismatches > 0) {
      appLogger.warn({ mismatches }, 'Payment reconciliation mismatch');
      await this.alerts.publish(
        'Payment reconciliation mismatch',
        `${String(mismatches)} payments differ from the gateway.`,
      );
    }
    await this.scheduleReconcile(now);
    return mismatches;
  }

  async scheduleReconcile(now: Date): Promise<void> {
    const runAt = new Date(now.getTime() + DAY_MS);
    await this.jobs.enqueue(this.pool, {
      kind: RECONCILE_JOB,
      runAt,
      dedupeKey: `reconcile:${runAt.toISOString().slice(0, 10)}`,
    });
  }
}
