import { Injectable } from '@nestjs/common';
import type { SmsTemplate } from '../adapters/sms.port.js';
import { appLogger } from '../common/app-logger.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { Notifier } from '../notifications/notifier.service.js';
import { RefundsService } from '../payments/refunds.service.js';
import { LedgerService } from '../payouts/ledger.service.js';
import { SlotLocks } from '../availability/slot-locks.js';
import { SYSTEM } from './booking-actor.js';
import { BookingLifecycle } from './booking-lifecycle.js';
import { BookingRepository } from './booking.repository.js';

export interface Message {
  to: string;
  template: SmsTemplate;
  params?: Record<string, string>;
  bookingId?: string;
}

/** Work that follows a committed booking change: messages, gateway refunds, freed holds. */
export interface Effects {
  messages: Message[];
  refundBookings: string[];
  releaseHolds: { providerId: string; start: Date; holder: string }[];
}

export const noEffects = (): Effects => ({ messages: [], refundBookings: [], releaseHolds: [] });

/**
 * Runs the network side of a booking change after its transaction has committed (no network
 * calls inside a transaction), and settles processed refunds onto the booking (PY-02).
 */
@Injectable()
export class BookingEffects {
  constructor(
    private readonly notifier: Notifier,
    private readonly refunds: RefundsService,
    private readonly bookings: BookingRepository,
    private readonly lifecycle: BookingLifecycle,
    private readonly ledger: LedgerService,
    private readonly locks: SlotLocks,
  ) {}

  async run(effects: Effects): Promise<void> {
    for (const hold of effects.releaseHolds)
      await this.locks.release(hold.providerId, hold.start, hold.holder);
    for (const bookingId of new Set(effects.refundBookings)) {
      await this.settleRefunds(bookingId).catch(() => {
        appLogger.warn('Refund left for retry');
      });
    }
    for (const message of effects.messages) {
      await this.notifier.notify(
        message.to,
        message.template,
        message.params ?? {},
        message.bookingId,
      );
    }
  }

  /** Sends pending refunds; the booking moves to Refunded once a cancellation's refund is out. */
  async settleRefunds(bookingId: string): Promise<number> {
    return this.refunds.process(bookingId, (client, paise) =>
      this.settled(client, bookingId, paise),
    );
  }

  private async settled(
    client: TransactionClient,
    bookingId: string,
    paise: number,
  ): Promise<void> {
    await this.bookings.addRefunded(client, bookingId, paise);
    const booking = await this.bookings.lock(client, bookingId);
    if (!booking) return;
    if (booking.status === 'completed') await this.ledger.reverse(client, bookingId, paise);
    if (booking.status === 'cancelled' || booking.status === 'no_show') {
      await this.lifecycle.apply(client, booking, 'refund', SYSTEM, null);
    }
  }
}
