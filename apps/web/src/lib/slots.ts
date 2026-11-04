/** Grouping server-provided free times for the day and time picker (AV-02, AV-04, G07). */

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DayPart = 'morning' | 'afternoon' | 'evening';
export const DAY_PARTS: readonly DayPart[] = ['morning', 'afternoon', 'evening'];

/** The India calendar day of an instant, as YYYY-MM-DD. */
export function indiaDay(iso: string | Date): string {
  const time = typeof iso === 'string' ? Date.parse(iso) : iso.getTime();
  return new Date(time + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Noon in India on a YYYY-MM-DD day: a safe instant for formatting that day's labels. */
export function indiaNoon(day: string): Date {
  return new Date(Date.parse(`${day}T12:00:00Z`) - IST_OFFSET_MS);
}

/** Morning before 12:00, afternoon before 17:00, evening after, in India time. */
export function dayPart(iso: string): DayPart {
  const hour = new Date(Date.parse(iso) + IST_OFFSET_MS).getUTCHours();
  if (hour < 12) return 'morning';
  return hour < 17 ? 'afternoon' : 'evening';
}

/** `count` consecutive India days starting at `first`. */
export function daysFrom(first: string, count: number): string[] {
  const start = Date.parse(`${first}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(start + index * DAY_MS).toISOString().slice(0, 10),
  );
}

/** Free times by India day, each day's times in order. */
export function slotsByDay(slots: readonly string[]): Map<string, string[]> {
  const days = new Map<string, string[]>();
  for (const slot of [...slots].sort((a, b) => a.localeCompare(b))) {
    const day = indiaDay(slot);
    days.set(day, [...(days.get(day) ?? []), slot]);
  }
  return days;
}
