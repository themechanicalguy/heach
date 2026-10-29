/** Booking statuses, exactly those of BK-02. */
export const BOOKING_STATUSES = [
  'pending_payment',
  'requested',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
  'refunded',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type Actor = 'patient' | 'provider' | 'admin' | 'system';

export type BookingEvent =
  | 'paid'
  | 'expire'
  | 'accept'
  | 'decline'
  | 'window_lapsed'
  | 'cancel'
  | 'start'
  | 'complete'
  | 'no_show_patient'
  | 'no_show_provider'
  | 'refund';

export interface Transition {
  to: BookingStatus;
  cancelledBy?: Actor;
  noShowParty?: 'patient' | 'provider';
}

interface Rule {
  from: readonly BookingStatus[];
  actors: readonly Actor[];
  to: (actor: Actor) => Transition;
}

const cancelled = (actor: Actor): Transition => ({ to: 'cancelled', cancelledBy: actor });

// The whole state machine (BK-02, BK-03, BK-04, A12, A15): one rule per event.
const RULES: Record<BookingEvent, Rule> = {
  paid: { from: ['pending_payment'], actors: ['system'], to: () => ({ to: 'requested' }) },
  expire: { from: ['pending_payment'], actors: ['system'], to: cancelled },
  accept: { from: ['requested'], actors: ['provider', 'admin'], to: () => ({ to: 'confirmed' }) },
  decline: { from: ['requested'], actors: ['provider'], to: cancelled },
  window_lapsed: { from: ['requested'], actors: ['system'], to: cancelled },
  cancel: {
    from: ['pending_payment', 'requested', 'confirmed', 'in_progress'],
    actors: ['patient', 'provider', 'admin', 'system'],
    to: cancelled,
  },
  start: { from: ['confirmed'], actors: ['provider'], to: () => ({ to: 'in_progress' }) },
  complete: {
    from: ['in_progress'],
    actors: ['provider', 'admin', 'system'],
    to: () => ({ to: 'completed' }),
  },
  no_show_patient: {
    from: ['confirmed'],
    actors: ['provider', 'admin'],
    to: () => ({ to: 'no_show', noShowParty: 'patient' }),
  },
  no_show_provider: {
    from: ['confirmed'],
    actors: ['patient', 'admin', 'system'],
    to: () => ({ to: 'no_show', noShowParty: 'provider' }),
  },
  refund: {
    from: ['cancelled', 'no_show', 'completed'],
    actors: ['system', 'admin'],
    to: () => ({ to: 'refunded' }),
  },
};

/** Who may cancel from where: a patient or provider cannot cancel a visit already started. */
function cancelAllowed(from: BookingStatus, actor: Actor): boolean {
  if (from === 'in_progress') return actor === 'admin';
  if (from === 'pending_payment') return actor === 'patient' || actor === 'system';
  return true;
}

/** The next status for this event and actor, or undefined when the change is not allowed. */
export function nextStatus(
  from: BookingStatus,
  event: BookingEvent,
  actor: Actor,
): Transition | undefined {
  const rule = RULES[event];
  if (!rule.from.includes(from) || !rule.actors.includes(actor)) return undefined;
  if (event === 'cancel' && !cancelAllowed(from, actor)) return undefined;
  return rule.to(actor);
}

/** Statuses in which the provider's time is taken. */
export const LIVE_STATUSES: readonly BookingStatus[] = ['requested', 'confirmed', 'in_progress'];
