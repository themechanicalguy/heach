import {
  ConflictException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { SlotService } from '../availability/slot.service.js';
import { reason } from '../common/error-response.js';
import type { Principal } from '../common/request-context.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { JobRunner } from '../jobs/runner/job-runner.js';
import { RefundsService } from '../payments/refunds.service.js';
import { Settings } from '../settings/settings.service.js';
import { actorOf, SYSTEM } from './booking-actor.js';
import { BookingEffects, type Effects, noEffects } from './booking-effects.js';
import { BookingLifecycle } from './booking-lifecycle.js';
import { BookingRepository, type BookingRow } from './booking.repository.js';
import { CancellationService } from './cancellation.service.js';
import { CheckoutService } from './checkout.service.js';
import { DispatchRepository } from './dispatch.repository.js';

export const DISPATCH_JOB = 'dispatch_wave';
export const ACCEPTANCE_JOB = 'acceptance_timeout';
export const REMINDER_JOB = 'booking_reminder';
export const PROVIDER_NO_SHOW_JOB = 'provider_no_show_check';
const MINUTE = 60_000;

/**
 * Who gets a request and who wins it (BK-03, amendments A10 and A14). A chosen provider gets one
 * offer; "any available" sends waves to eligible providers ranked by earlier care of this patient.
 * The first accept wins under the booking's row lock; every other offer is withdrawn. A decline
 * for an invalid prescription cancels with a full refund; an unanswered request lapses.
 */
@Injectable()
export class DispatchService implements OnModuleInit {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly dispatch: DispatchRepository,
    private readonly lifecycle: BookingLifecycle,
    private readonly cancellation: CancellationService,
    private readonly checkout: CheckoutService,
    private readonly refunds: RefundsService,
    private readonly slots: SlotService,
    private readonly settings: Settings,
    private readonly jobs: JobRunner,
    private readonly effects: BookingEffects,
  ) {}

  onModuleInit(): void {
    this.jobs.register(DISPATCH_JOB, (payload, now) =>
      this.wave(payload.bookingId ?? '', Number(payload.wave ?? 1), now),
    );
    this.jobs.register(ACCEPTANCE_JOB, (payload) => this.lapse(payload.bookingId ?? ''));
  }

  /** Called in the paid transaction: opens the acceptance window and sends the first offers. */
  async open(client: TransactionClient, booking: BookingRow, now: Date): Promise<Effects> {
    const acceptBy = new Date(
      now.getTime() + (await this.settings.get('acceptance_window_minutes')) * MINUTE,
    );
    await this.bookings.setAcceptBy(client, booking.id, acceptBy);
    await this.jobs.enqueue(client, {
      kind: ACCEPTANCE_JOB,
      payload: { bookingId: booking.id },
      runAt: acceptBy,
      dedupeKey: `accept:${booking.id}`,
    });
    const effects = noEffects();
    if (booking.matching === 'any') {
      await this.jobs.enqueue(client, {
        kind: DISPATCH_JOB,
        payload: { bookingId: booking.id, wave: '1' },
        runAt: now,
        dedupeKey: `dispatch:${booking.id}:1`,
      });
      return effects;
    }
    if (booking.providerId && booking.listingId) {
      await this.dispatch.offer(client, {
        bookingId: booking.id,
        providerId: booking.providerId,
        listingId: booking.listingId,
        wave: 0,
      });
      effects.messages.push(this.request(booking, booking.providerId));
    }
    return effects;
  }

  async wave(bookingId: string, wave: number, now: Date): Promise<void> {
    const effects = await this.bookings.transaction(async (client) => {
      const booking = await this.bookings.lock(client, bookingId);
      if (booking?.status !== 'requested') return noEffects();
      const offered = new Set(
        (await this.dispatch.offers(client, bookingId)).map((offer) => offer.providerId),
      );
      const candidates = (
        await this.dispatch.eligible(
          {
            itemId: booking.itemId,
            pin: booking.pin,
            gender: booking.genderPreference,
            bookerId: booking.bookerId,
          },
          client,
        )
      ).filter((listing) => !offered.has(listing.providerId));
      const size = await this.settings.get('dispatch_wave_size');
      const chosen = [];
      for (const listing of candidates) {
        if (chosen.length >= size) break;
        if (
          await this.slots.isOffered(
            { ...this.checkout.slotRequest(listing), now },
            booking.startsAt,
          )
        )
          chosen.push(listing);
      }
      const result = noEffects();
      for (const listing of chosen) {
        await this.dispatch.offer(client, {
          bookingId,
          providerId: listing.providerId,
          listingId: listing.listingId,
          wave,
        });
        result.messages.push(this.request(booking, listing.providerId));
      }
      if (candidates.length > chosen.length) {
        const runAt = new Date(
          now.getTime() + (await this.settings.get('dispatch_wave_minutes')) * MINUTE,
        );
        await this.jobs.enqueue(client, {
          kind: DISPATCH_JOB,
          payload: { bookingId, wave: String(wave + 1) },
          runAt,
          dedupeKey: `dispatch:${bookingId}:${String(wave + 1)}`,
        });
      }
      return result;
    });
    await this.effects.run(effects);
  }

  async accept(principal: Principal, bookingId: string): Promise<void> {
    const effects = await this.bookings.transaction(async (client) => {
      const booking = await this.bookings.lock(client, bookingId);
      const offer = (await this.dispatch.offers(client, bookingId)).find(
        (row) => row.providerId === principal.userId,
      );
      if (!booking || !offer) throw new NotFoundException();
      if (booking.status !== 'requested' || offer.status !== 'offered')
        throw reason(ConflictException, 'offer_closed');
      if (
        await this.bookings.providerBusy(
          client,
          principal.userId,
          { start: booking.startsAt, end: booking.endsAt },
          bookingId,
        )
      ) {
        throw reason(ConflictException, 'provider_busy');
      }
      await this.dispatch.respond(client, bookingId, principal.userId, { status: 'accepted' });
      await this.dispatch.closeOthers(client, bookingId, 'withdrawn');
      const result =
        booking.matching === 'any'
          ? await this.assign(client, booking, offer.listingId, principal.userId)
          : noEffects();
      await this.lifecycle.apply(client, booking, 'accept', actorOf(principal));
      if (booking.kind === 'shift')
        await this.bookings.createShifts(client, booking, principal.userId);
      await this.remind(client, booking);
      result.messages.push({
        to: booking.bookerId,
        template: 'booking_confirmed',
        params: { time: booking.startsAt.toISOString() },
        bookingId,
      });
      return result;
    });
    await this.effects.run(effects);
  }

  async decline(principal: Principal, bookingId: string, why: string): Promise<void> {
    const effects = await this.bookings.transaction(async (client) => {
      const booking = await this.bookings.lock(client, bookingId);
      if (booking?.status !== 'requested') throw reason(ConflictException, 'offer_closed');
      if (
        !(await this.dispatch.respond(client, bookingId, principal.userId, {
          status: 'declined',
          reason: why,
        }))
      ) {
        throw new NotFoundException();
      }
      if (booking.matching === 'chosen')
        return this.cancellation.cancel(client, booking, actorOf(principal), why, {
          event: 'decline',
        });
      if (why === 'prescription_invalid')
        return this.cancellation.cancel(client, booking, SYSTEM, why);
      const open = (await this.dispatch.offers(client, bookingId)).filter(
        (offer) => offer.status === 'offered',
      );
      if (open.length === 0) {
        const wave =
          Math.max(...(await this.dispatch.offers(client, bookingId)).map((offer) => offer.wave)) +
          1;
        await this.jobs.enqueue(client, {
          kind: DISPATCH_JOB,
          payload: { bookingId, wave: String(wave) },
          dedupeKey: `dispatch:${bookingId}:${String(wave)}`,
        });
      }
      return noEffects();
    });
    await this.effects.run(effects);
  }

  /** The window passed with nobody accepting: cancel and refund in full (BK-03). */
  async lapse(bookingId: string): Promise<void> {
    const effects = await this.bookings.transaction(async (client) => {
      const booking = await this.bookings.lock(client, bookingId);
      if (booking?.status !== 'requested') return noEffects();
      return this.cancellation.cancel(client, booking, SYSTEM, 'not_accepted', {
        event: 'window_lapsed',
      });
    });
    await this.effects.run(effects);
  }

  /** Binds the accepting provider's prices and refunds what the quote charged above them. */
  private async assign(
    client: TransactionClient,
    booking: BookingRow,
    listingId: string,
    providerId: string,
  ): Promise<Effects> {
    const listing = await this.dispatch.listing(listingId, client);
    if (!listing) throw new NotFoundException();
    const fees = await this.checkout.fees(listing, booking.shiftDays);
    await this.bookings.assign(client, booking.id, { providerId, listingId, fees });
    const effects = noEffects();
    const over = booking.paidPaise - fees.advancePaise;
    if (over > 0) {
      await this.refunds.plan(client, {
        bookingId: booking.id,
        amountPaise: over,
        reason: 'price_difference',
        actorRole: 'system',
      });
      effects.refundBookings.push(booking.id);
    }
    return effects;
  }

  private async remind(client: TransactionClient, booking: BookingRow): Promise<void> {
    // An hour after the start with no visit begun, the provider is treated as absent (A12).
    await this.jobs.enqueue(client, {
      kind: PROVIDER_NO_SHOW_JOB,
      payload: { bookingId: booking.id },
      runAt: new Date(booking.startsAt.getTime() + 60 * MINUTE),
      dedupeKey: `provider-no-show:${booking.id}`,
    });
    for (const [label, minutes] of [
      ['24h', 1440],
      ['15m', 15],
    ] as const) {
      const runAt = new Date(booking.startsAt.getTime() - minutes * MINUTE);
      if (runAt.getTime() <= Date.now()) continue;
      await this.jobs.enqueue(client, {
        kind: REMINDER_JOB,
        payload: { bookingId: booking.id },
        runAt,
        dedupeKey: `remind:${booking.id}:${label}`,
      });
    }
  }

  private request(booking: BookingRow, providerId: string) {
    return {
      to: providerId,
      template: 'booking_request' as const,
      params: { time: booking.startsAt.toISOString() },
      bookingId: booking.id,
    };
  }
}
