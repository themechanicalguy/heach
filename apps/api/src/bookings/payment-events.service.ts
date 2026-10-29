import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  type GatewayEvent,
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from '../adapters/payments.port.js';
import { AuditService } from '../audit/audit.service.js';
import { reason } from '../common/error-response.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { PaymentsRepository, type PaymentRow } from '../payments/payments.repository.js';
import { SYSTEM } from './booking-actor.js';
import { BookingEffects, type Effects, noEffects } from './booking-effects.js';
import { BookingLifecycle } from './booking-lifecycle.js';
import { BookingRepository, type BookingRow } from './booking.repository.js';
import { CancellationService } from './cancellation.service.js';
import { DispatchService } from './dispatch.service.js';

export type WebhookOutcome = 'processed' | 'duplicate' | 'ignored';

/**
 * Gateway webhooks, the only thing that moves a booking out of Pending payment (PY-01). Each is
 * verified, processed once (duplicates are acknowledged and ignored) and safe out of order: a
 * payment for a booking already cancelled, or whose slot was taken meanwhile, is refunded in full
 * (edge cases 2 and 3).
 */
@Injectable()
export class PaymentEventsService {
  constructor(
    private readonly payments: PaymentsRepository,
    private readonly bookings: BookingRepository,
    private readonly lifecycle: BookingLifecycle,
    private readonly dispatch: DispatchService,
    private readonly cancellation: CancellationService,
    private readonly effects: BookingEffects,
    private readonly audit: AuditService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async handle(body: string, signature: string, now = new Date()): Promise<WebhookOutcome> {
    if (!signature || !this.gateway.verifyWebhook(body, signature))
      throw reason(BadRequestException, 'webhook_signature');
    const event = this.gateway.parseEvent(body);
    const result = await this.bookings.transaction(async (client) => {
      if (!(await this.payments.firstDelivery(client, event.id, event.kind)))
        return { outcome: 'duplicate' as const, effects: noEffects() };
      const payment = await this.payments.byOrder(event.orderId, client);
      if (!payment) return { outcome: 'ignored' as const, effects: noEffects() };
      const booking = await this.bookings.lock(client, payment.bookingId);
      if (!booking) return { outcome: 'ignored' as const, effects: noEffects() };
      const effects = await this.apply(client, event, payment, booking, now);
      await this.audit.record(
        { action: `payment.${event.kind}`, entity: 'booking', entityId: booking.id },
        client,
      );
      return { outcome: 'processed' as const, effects };
    });
    await this.effects.run(result.effects);
    return result.outcome;
  }

  private async apply(
    client: TransactionClient,
    event: GatewayEvent,
    payment: PaymentRow,
    booking: BookingRow,
    now: Date,
  ): Promise<Effects> {
    if (event.kind === 'payment.failed') {
      await this.payments.markFailed(client, payment.id);
      return noEffects();
    }
    if (
      event.amountPaise !== payment.amountPaise ||
      !(await this.payments.markPaid(client, payment.id, event.paymentId))
    ) {
      return noEffects();
    }
    await this.bookings.addPaid(client, booking.id, payment.amountPaise);
    const paid = { ...booking, paidPaise: booking.paidPaise + payment.amountPaise };
    if (payment.purpose === 'balance') return noEffects();
    if (booking.status !== 'pending_payment')
      return this.refundLate(client, paid, payment.amountPaise);
    const taken =
      booking.providerId !== null &&
      (await this.bookings.providerBusy(
        client,
        booking.providerId,
        { start: booking.startsAt, end: booking.endsAt },
        booking.id,
      ));
    await this.lifecycle.apply(client, booking, 'paid', SYSTEM);
    const requested = { ...paid, status: 'requested' as const };
    if (taken) return this.cancellation.cancel(client, requested, SYSTEM, 'slot_taken');
    const effects = await this.dispatch.open(client, requested, now);
    if (booking.providerId)
      effects.releaseHolds.push({
        providerId: booking.providerId,
        start: booking.startsAt,
        holder: booking.bookerId,
      });
    return effects;
  }

  /** Money arrived for a booking that is no longer waiting for it: give it all back. */
  private async refundLate(
    client: TransactionClient,
    booking: BookingRow,
    amountPaise: number,
  ): Promise<Effects> {
    const effects = noEffects();
    await this.cancellation.refundOnly(client, booking, amountPaise, 'late_payment');
    effects.refundBookings.push(booking.id);
    return effects;
  }
}
