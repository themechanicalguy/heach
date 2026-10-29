/** Weekly hours in IST (AV-01, AV-04): minutes after midnight; weekday 0 is Sunday. */
export interface WeeklyRule {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface Interval {
  start: Date;
  end: Date;
}

export interface SlotInput {
  rules: readonly WeeklyRule[];
  /** Leave, closures and existing bookings: no slot may touch them, buffers included. */
  busy: readonly Interval[];
  durationMinutes: number;
  bufferMinutes: number;
  now: Date;
  days: number;
  /** Shifts start at a fixed time of day; visits on a 30-minute grid inside the rules. */
  fixedStartMinute?: number | undefined;
  leadMinutes?: number | undefined;
}

const MINUTE = 60_000;
const IST_OFFSET_MINUTES = 330;
const GRID_MINUTES = 30;
/** A home visit cannot be booked for less than two hours from now (travel time). */
export const DEFAULT_LEAD_MINUTES = 120;
export const MAX_DAYS = 14;

/** Midnight IST of the day `now` falls on, plus `offsetDays`, as a UTC instant. */
export function istDayStart(now: Date, offsetDays = 0): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MINUTES * MINUTE);
  const midnight = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + offsetDays);
  return new Date(midnight - IST_OFFSET_MINUTES * MINUTE);
}

/** IST weekday (0 Sunday) of an IST midnight produced by `istDayStart`. */
function istWeekday(dayStart: Date): number {
  return new Date(dayStart.getTime() + IST_OFFSET_MINUTES * MINUTE).getUTCDay();
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

function candidateMinutes(rule: WeeklyRule, input: SlotInput): number[] {
  if (input.fixedStartMinute !== undefined) {
    const fixed = input.fixedStartMinute;
    return fixed >= rule.startMinute && fixed < rule.endMinute ? [fixed] : [];
  }
  const minutes: number[] = [];
  const first = Math.ceil(rule.startMinute / GRID_MINUTES) * GRID_MINUTES;
  for (
    let minute = first;
    minute + input.durationMinutes <= rule.endMinute;
    minute += GRID_MINUTES
  ) {
    minutes.push(minute);
  }
  return minutes;
}

/** Whether a booking at `start` fits the provider's time, buffers and lead time. */
export function isFree(start: Date, input: SlotInput): boolean {
  const lead = (input.leadMinutes ?? DEFAULT_LEAD_MINUTES) * MINUTE;
  if (start.getTime() < input.now.getTime() + lead) return false;
  const buffer = input.bufferMinutes * MINUTE;
  const padded = {
    start: new Date(start.getTime() - buffer),
    end: new Date(start.getTime() + input.durationMinutes * MINUTE + buffer),
  };
  return !input.busy.some((busy) => overlaps(padded, busy));
}

/** Bookable start times over the next `days` days in IST, earliest first (AV-02, AV-03). */
export function generateSlots(input: SlotInput): Date[] {
  const slots = new Set<number>();
  for (let offset = 0; offset < Math.min(input.days, MAX_DAYS); offset += 1) {
    const dayStart = istDayStart(input.now, offset);
    const weekday = istWeekday(dayStart);
    for (const rule of input.rules.filter((candidate) => candidate.weekday === weekday)) {
      for (const minute of candidateMinutes(rule, input)) {
        const start = new Date(dayStart.getTime() + minute * MINUTE);
        if (isFree(start, input)) slots.add(start.getTime());
      }
    }
  }
  return [...slots].sort((a, b) => a - b).map((time) => new Date(time));
}

/** Whether `start` is one of the slots the rules offer, for checking a requested time. */
export function isOfferedSlot(start: Date, input: SlotInput): boolean {
  const days =
    Math.ceil((start.getTime() - istDayStart(input.now).getTime()) / (1440 * MINUTE)) + 1;
  if (days < 1 || days > MAX_DAYS) return false;
  return generateSlots({ ...input, days }).some((slot) => slot.getTime() === start.getTime());
}
