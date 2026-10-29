import { CARE_ROLES, type Principal } from '../common/request-context.js';
import type { Actor } from './booking-transitions.js';

export interface BookingActor {
  id: string | null;
  role: string;
  kind: Actor;
}

export const SYSTEM: BookingActor = { id: null, role: 'system', kind: 'system' };

/** Who acts on a booking, from the server-checked principal. */
export function actorOf(principal: Principal): BookingActor {
  if (principal.realm === 'admin')
    return { id: principal.userId, role: principal.role, kind: 'admin' };
  const care = (CARE_ROLES as readonly string[]).includes(principal.role);
  return { id: principal.userId, role: principal.role, kind: care ? 'patient' : 'provider' };
}
