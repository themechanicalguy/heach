import { Injectable } from '@nestjs/common';
import type { TransactionClient } from '../data-stores/transaction.js';
import { RefundsService } from '../payments/refunds.service.js';
import { Settings } from '../settings/settings.service.js';
import type { BookingActor } from './booking-actor.js';
import { type Effects, noEffects } from './booking-effects.js';
import { BookingLifecycle } from './booking-lifecycle.js';
import type { BookingRow } from './booking.repository.js';
import { DispatchRepository } from './dispatch.repository.js';
import { cancellationRefund } from './fees.js';

/**
 * Cancellation under the published policy (BK-04, PY-02): the refund is computed by the policy,
 * planned in the same transaction as the cancel, and the other party is told.
 */
@Injectable()
export class CancellationService {
  constructor(
    private readonly lifecycle: BookingLifecycle,
    private readonly refunds: RefundsService,
    private readonly dispatch: DispatchRepository,
    private readonly settings: Settings,
  ) {}

  /** What cancelling now would refund, for the policy shown before the patient confirms. */
  async refundIfCancelled(
    booking: BookingRow,
    by: BookingActor['kind'],
    now = new Date(),
  ): Promise<number> {
    if (!['pending_payment', 'requested', 'confirmed', 'in_progress'].includes(booking.status))
      return 0;
    const policy = {
      freeCancellationHours: await this.settings.get('free_cancellation_hours'),
      lateRefundPercent: await this.settings.get('late_cancellation_refund_percent'),
    };
    return cancellationRefund({
      status: booking.status as 'pending_payment',
      by,
      paidPaise: booking.paidPaise - booking.refundedPaise,
      startsAt: booking.startsAt,
      now,
      policy,
    });
  }

  /** Plans a refund without a status change (a late payment, a price difference). */
  async refundOnly(
    client: TransactionClient,
    booking: BookingRow,
    amountPaise: number,
    why: string,
  ): Promise<void> {
    await this.refunds.plan(client, {
      bookingId: booking.id,
      amountPaise,
      reason: why,
      actorRole: 'system',
    });
  }

  /** Cancels inside the caller's transaction; returns the effects to run after commit. */
  async cancel(
    client: TransactionClient,
    booking: BookingRow,
    actor: BookingActor,
    why: string,
    options: {
      refundPaise?: number;
      event?: 'cancel' | 'decline' | 'window_lapsed' | 'expire';
    } = {},
  ): Promise<Effects> {
    const refundPaise = options.refundPaise ?? (await this.refundIfCancelled(booking, actor.kind));
    await this.lifecycle.apply(client, booking, options.event ?? 'cancel', actor, why);
    await this.dispatch.closeOthers(
      client,
      booking.id,
      options.event === 'window_lapsed' ? 'expired' : 'withdrawn',
    );
    const effects = noEffects();
    if (refundPaise > 0) {
      await this.refunds.plan(client, {
        bookingId: booking.id,
        amountPaise: refundPaise,
        reason: why,
        actorRole: actor.role,
      });
      effects.refundBookings.push(booking.id);
    }
    const time = booking.startsAt.toISOString();
    if (actor.kind !== 'patient' && booking.status !== 'pending_payment') {
      effects.messages.push({
        to: booking.bookerId,
        template: 'booking_cancelled',
        params: { time },
        bookingId: booking.id,
      });
    }
    if (
      actor.kind !== 'provider' &&
      booking.providerId &&
      booking.status !== 'pending_payment' &&
      booking.status !== 'requested'
    ) {
      effects.messages.push({
        to: booking.providerId,
        template: 'booking_cancelled',
        params: { time },
        bookingId: booking.id,
      });
    }
    return effects;
  }
}
