const KEY = 'heach-bookings-summary';

/** What may be kept on the device (BK-07, EN-11): service, time and provider name only. */
export interface OfflineBooking {
  id: string;
  itemName: string;
  startsAt: string;
  providerName: string | null;
  status: string;
}

export function saveOfflineSummary(bookings: readonly OfflineBooking[]): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(
        bookings.map(({ id, itemName, startsAt, providerName, status }) => ({
          id,
          itemName,
          startsAt,
          providerName,
          status,
        })),
      ),
    );
  } catch {
    // Storage full or blocked: the summary is a convenience only.
  }
}

export function readOfflineSummary(): OfflineBooking[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as OfflineBooking[];
  } catch {
    return [];
  }
}

export function clearOfflineSummary(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
