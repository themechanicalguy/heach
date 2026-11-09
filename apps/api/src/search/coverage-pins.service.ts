import { Injectable } from '@nestjs/common';
import { SlotService } from '../availability/slot.service.js';
import type { Service } from '../catalogue/services.js';
import { CoveragePinsCache } from './coverage-pins.cache.js';
import { listingKey, type PinSummary, summarisePins } from './coverage-pins.js';
import { SearchRepository } from './search.repository.js';

const SLOT_DAYS = 7;

/** Serviceable PINs with provider counts and the soonest free time, built once per cache window. */
@Injectable()
export class CoveragePinsService {
  private readonly building = new Map<Service, Promise<PinSummary[]>>();

  constructor(
    private readonly search: SearchRepository,
    private readonly slots: SlotService,
    private readonly cache: CoveragePinsCache,
  ) {}

  async list(service: Service): Promise<PinSummary[]> {
    const cached = await this.cache.read(service);
    if (cached) return cached;
    // Requests arriving while one is building share its result instead of each querying.
    const running = this.building.get(service) ?? this.build(service);
    this.building.set(service, running);
    return running;
  }

  private async build(service: Service): Promise<PinSummary[]> {
    try {
      const rows = await this.search.pinProviders(service);
      const listings = new Map<string, { providerId: string; itemCode: string; minutes: number }>();
      for (const row of rows) {
        if (row.providerId && row.itemCode && row.durationMinutes !== null)
          listings.set(listingKey(row.providerId, row.itemCode), {
            providerId: row.providerId,
            itemCode: row.itemCode,
            minutes: row.durationMinutes,
          });
      }
      const wanted = [...listings];
      const slots = await this.slots.earliestFor(
        wanted.map(([, value]) => ({
          providerId: value.providerId,
          itemCode: value.itemCode,
          durationMinutes: value.minutes,
          days: SLOT_DAYS,
        })),
      );
      const earliest = new Map(wanted.map(([key], index) => [key, slots[index] ?? null]));
      const pins = summarisePins(rows, earliest);
      await this.cache.write(service, pins);
      return pins;
    } finally {
      this.building.delete(service);
    }
  }
}
