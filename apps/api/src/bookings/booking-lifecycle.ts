import { ConflictException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { reason } from '../common/error-response.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import type { BookingActor } from './booking-actor.js';
import { type BookingEvent, nextStatus, type Transition } from './booking-transitions.js';
import { BookingRepository, type BookingRow } from './booking.repository.js';
import { JobRunner } from '../jobs/runner/job-runner.js';

export const REFERRAL_QUALIFY_JOB = 'referral_qualify';

/**
 * The one way a booking changes status (state machine rules): the transition is checked against
 * the pure state machine, refused with a typed error when not allowed, and written together with
 * its booking event and audit entry.
 */
@Injectable()
export class BookingLifecycle {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly audit: AuditService,
    private readonly jobs: JobRunner,
  ) {}

  async apply(
    client: TransactionClient,
    booking: Pick<BookingRow, 'id' | 'status'>,
    event: BookingEvent,
    actor: BookingActor,
    why: string | null = null,
  ): Promise<Transition> {
    const change = nextStatus(booking.status, event, actor.kind);
    if (!change) throw reason(ConflictException, 'booking_transition_refused');
    await this.bookings.transition(client, booking, change, actor, why);
    // A first completed booking may reward a referral (RR-02); checked by its own job.
    if (change.to === 'completed') {
      await this.jobs.enqueue(client, {
        kind: REFERRAL_QUALIFY_JOB,
        payload: { bookingId: booking.id },
        dedupeKey: `referral:${booking.id}`,
      });
    }
    await this.audit.record(
      { action: `booking.${event}`, entity: 'booking', entityId: booking.id },
      client,
    );
    return change;
  }
}
