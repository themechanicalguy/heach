import type { WeeklyRule } from '@heach/types';

export interface DayHours {
  open: boolean;
  from: string;
  to: string;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Minutes after midnight as HH:MM; 1440 shows as 24:00. */
export function toClock(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function toMinutes(clock: string): number {
  const [hours = 0, minutes = 0] = clock.split(':').map(Number);
  return hours * 60 + minutes;
}

/** One row per weekday from the stored rules (the first rule of a day; AV-01). */
export function daysFromRules(rules: readonly WeeklyRule[]): DayHours[] {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
    const rule = rules.find((candidate) => candidate.weekday === weekday);
    return rule
      ? { open: true, from: toClock(rule.startMinute), to: toClock(rule.endMinute) }
      : { open: false, from: '09:00', to: '18:00' };
  });
}

/** Rules for the open days; a "to" of 00:00 means midnight at the end of the day. */
export function rulesFromDays(days: readonly DayHours[]): WeeklyRule[] {
  return days.flatMap((day, weekday) => {
    if (!day.open) return [];
    const end = toMinutes(day.to);
    return [{ weekday, startMinute: toMinutes(day.from), endMinute: end === 0 ? 1440 : end }];
  });
}
