const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days an application has waited since it was submitted, never negative (G17). */
export function waitingDays(submittedAt: string | null, now: Date = new Date()): number | null {
  if (!submittedAt) return null;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(submittedAt)) / DAY_MS));
}

/** A badge tone by waiting time: two days or more needs attention, a week or more is late. */
export function waitingTone(days: number | null): 'neutral' | 'warning' | 'danger' {
  if (days === null || days < 2) return 'neutral';
  return days < 7 ? 'warning' : 'danger';
}
