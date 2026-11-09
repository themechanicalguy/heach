export const PIN_BANDS = ['available', 'limited', 'none'] as const;
export type PinBand = (typeof PIN_BANDS)[number];

/** Providers at or above this count make a PIN "available"; fewer, but some, is "limited". */
export const AVAILABLE_PROVIDERS = 3;

export interface PinProviderRow {
  pin: string;
  district: string;
  providerId: string | null;
  itemCode: string | null;
  durationMinutes: number | null;
}

export interface PinSummary {
  pin: string;
  district: string;
  providers: number;
  band: PinBand;
  nextAvailable: string | null;
}

export function pinBand(providers: number): PinBand {
  if (providers === 0) return 'none';
  return providers >= AVAILABLE_PROVIDERS ? 'available' : 'limited';
}

/** The key of one bookable listing, so each is asked for its earliest slot once. */
export const listingKey = (providerId: string, itemCode: string) => `${providerId}:${itemCode}`;

/**
 * One row per serviceable PIN: how many providers serve it and the soonest free time across them.
 * `earliest` maps `listingKey` to that listing's earliest slot.
 */
export function summarisePins(
  rows: readonly PinProviderRow[],
  earliest: ReadonlyMap<string, Date | null>,
): PinSummary[] {
  const byPin = new Map<string, { district: string; providers: Set<string>; next: Date | null }>();
  for (const row of rows) {
    const entry = byPin.get(row.pin) ?? {
      district: row.district,
      providers: new Set(),
      next: null,
    };
    byPin.set(row.pin, entry);
    if (!row.providerId || !row.itemCode) continue;
    entry.providers.add(row.providerId);
    const slot = earliest.get(listingKey(row.providerId, row.itemCode)) ?? null;
    if (slot && (!entry.next || slot < entry.next)) entry.next = slot;
  }
  return [...byPin].map(([pin, entry]) => ({
    pin,
    district: entry.district,
    providers: entry.providers.size,
    band: pinBand(entry.providers.size),
    nextAvailable: entry.next?.toISOString() ?? null,
  }));
}
