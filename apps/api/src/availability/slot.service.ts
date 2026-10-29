import { Injectable } from '@nestjs/common';
import { SHIFT_START_MINUTE } from '../catalogue/services.js';
import { AvailabilityRepository } from './availability.repository.js';
import { SlotLocks } from './slot-locks.js';
import { generateSlots, istDayStart, isOfferedSlot, MAX_DAYS, type SlotInput } from './slots.js';

export interface SlotRequest {
  providerId: string;
  itemCode: string;
  durationMinutes: number;
  days: number;
  now?: Date;
  /** The patient looking: their own checkout hold does not hide the slot from them. */
  viewer?: string | undefined;
}

/** Bookable times of one listing: rules, leave, bookings, buffers and checkout holds (AV-02). */
@Injectable()
export class SlotService {
  constructor(
    private readonly availability: AvailabilityRepository,
    private readonly locks: SlotLocks,
  ) {}

  async slots(request: SlotRequest): Promise<Date[]> {
    const input = await this.input(request);
    const slots = generateSlots(input);
    const held = await this.locks.heldByOthers(request.providerId, slots, request.viewer);
    return slots.filter((slot) => !held.has(slot.getTime()));
  }

  /** Whether `start` is still offered, ignoring holds (the caller takes the hold itself). */
  async isOffered(request: SlotRequest, start: Date): Promise<boolean> {
    return isOfferedSlot(start, await this.input({ ...request, days: MAX_DAYS }));
  }

  private async input(request: SlotRequest): Promise<SlotInput> {
    const now = request.now ?? new Date();
    const days = Math.min(request.days, MAX_DAYS);
    const [rules, bufferMinutes, busy] = await Promise.all([
      this.availability.rules(request.providerId),
      this.availability.bufferMinutes(request.providerId),
      this.availability.busy(request.providerId, istDayStart(now), istDayStart(now, days + 2)),
    ]);
    return {
      rules,
      busy,
      bufferMinutes,
      now,
      days,
      durationMinutes: request.durationMinutes,
      fixedStartMinute: SHIFT_START_MINUTE[request.itemCode],
    };
  }
}
