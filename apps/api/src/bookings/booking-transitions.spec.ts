import {
  type Actor,
  BOOKING_STATUSES,
  type BookingEvent,
  nextStatus,
} from './booking-transitions.js';

const EVENTS: BookingEvent[] = [
  'paid',
  'expire',
  'accept',
  'decline',
  'window_lapsed',
  'cancel',
  'start',
  'complete',
  'no_show_patient',
  'no_show_provider',
  'refund',
];
const ACTORS: Actor[] = ['patient', 'provider', 'admin', 'system'];

// Every allowed change, as from:event:actor => to. Everything else must be refused.
const ALLOWED: Record<string, string> = {
  'pending_payment:paid:system': 'requested',
  'pending_payment:expire:system': 'cancelled/system',
  'pending_payment:cancel:patient': 'cancelled/patient',
  'pending_payment:cancel:system': 'cancelled/system',
  'requested:accept:provider': 'confirmed',
  'requested:accept:admin': 'confirmed',
  'requested:decline:provider': 'cancelled/provider',
  'requested:window_lapsed:system': 'cancelled/system',
  'requested:cancel:patient': 'cancelled/patient',
  'requested:cancel:provider': 'cancelled/provider',
  'requested:cancel:admin': 'cancelled/admin',
  'requested:cancel:system': 'cancelled/system',
  'confirmed:start:provider': 'in_progress',
  'confirmed:cancel:patient': 'cancelled/patient',
  'confirmed:cancel:provider': 'cancelled/provider',
  'confirmed:cancel:admin': 'cancelled/admin',
  'confirmed:cancel:system': 'cancelled/system',
  'confirmed:no_show_patient:provider': 'no_show/patient',
  'confirmed:no_show_patient:admin': 'no_show/patient',
  'confirmed:no_show_provider:patient': 'no_show/provider',
  'confirmed:no_show_provider:admin': 'no_show/provider',
  'confirmed:no_show_provider:system': 'no_show/provider',
  'in_progress:complete:provider': 'completed',
  'in_progress:complete:admin': 'completed',
  'in_progress:complete:system': 'completed',
  'in_progress:cancel:admin': 'cancelled/admin',
  'cancelled:refund:system': 'refunded',
  'cancelled:refund:admin': 'refunded',
  'no_show:refund:system': 'refunded',
  'no_show:refund:admin': 'refunded',
  'completed:refund:system': 'refunded',
  'completed:refund:admin': 'refunded',
};

describe('Booking state machine (BK-02, BK-03, BK-04)', () => {
  it('BK-02 allows exactly the listed changes and refuses every other one', () => {
    for (const from of BOOKING_STATUSES) {
      for (const event of EVENTS) {
        for (const actor of ACTORS) {
          const result = nextStatus(from, event, actor);
          const shown =
            result &&
            [result.to, result.cancelledBy ?? result.noShowParty].filter(Boolean).join('/');
          expect([`${from}:${event}:${actor}`, shown]).toEqual([
            `${from}:${event}:${actor}`,
            ALLOWED[`${from}:${event}:${actor}`],
          ]);
        }
      }
    }
  });
});
