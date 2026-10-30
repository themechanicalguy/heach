import { Injectable, NotFoundException } from '@nestjs/common';
import { SlotService } from '../availability/slot.service.js';
import type { ProviderProfileDto, SearchQueryDto, SearchResultDto } from './search.dto.js';
import { SearchRepository } from './search.repository.js';

const SEARCH_DAYS = 7;

/** Search results with each listing's earliest slot, earliest first (SD-03, SD-04). */
@Injectable()
export class SearchService {
  constructor(
    private readonly search: SearchRepository,
    private readonly slots: SlotService,
  ) {}

  async find(query: SearchQueryDto): Promise<SearchResultDto[]> {
    const rows = await this.search.search(query);
    const earliest = await this.slots.earliestFor(
      rows.map((row) => ({
        providerId: row.providerId,
        itemCode: row.itemCode,
        durationMinutes: row.durationMinutes,
        days: SEARCH_DAYS,
      })),
    );
    const results = rows.map((row, index) => ({ ...row, earliestSlot: earliest[index] ?? null }));
    return results.sort(
      (a, b) => (a.earliestSlot?.getTime() ?? Infinity) - (b.earliestSlot?.getTime() ?? Infinity),
    );
  }

  async profile(providerId: string, locale: string): Promise<ProviderProfileDto> {
    const rows = await this.search.profile(providerId, locale);
    const first = rows[0];
    if (!first) throw new NotFoundException();
    const [facts, pins] = await Promise.all([
      this.search.publicFacts(providerId),
      this.search.pins(providerId),
    ]);
    return {
      id: providerId,
      name: first.name,
      role: first.role,
      gender: first.gender,
      languages: first.languages,
      ...facts,
      listings: rows.map((row) => ({
        listingId: row.listingId,
        itemCode: row.itemCode,
        itemName: row.itemName,
        kind: row.kind,
        prescriptionRequired: row.prescriptionRequired,
        feePaise: row.feePaise,
        durationMinutes: row.durationMinutes,
        preparation: row.preparation,
      })),
      pins,
      travelSurchargePaise: first.travelSurchargePaise,
      rating: first.rating,
      ratingCount: first.ratingCount,
    };
  }

  async listingSlots(providerId: string, listingId: string, days: number): Promise<Date[]> {
    const listing = (await this.search.profile(providerId, 'en')).find(
      (row) => row.listingId === listingId,
    );
    if (!listing) throw new NotFoundException();
    return this.slots.slots({
      providerId,
      itemCode: listing.itemCode,
      durationMinutes: listing.durationMinutes,
      days,
    });
  }
}
