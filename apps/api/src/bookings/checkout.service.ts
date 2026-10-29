import { randomUUID } from 'node:crypto';
import type { FieldEncryptor } from '@heach/crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type pg from 'pg';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../adapters/payments.port.js';
import { AuditService } from '../audit/audit.service.js';
import { SlotLocks } from '../availability/slot-locks.js';
import { SlotService } from '../availability/slot.service.js';
import { reason } from '../common/error-response.js';
import type { Principal } from '../common/request-context.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { JobRunner } from '../jobs/runner/job-runner.js';
import { PaymentsRepository } from '../payments/payments.repository.js';
import { Settings } from '../settings/settings.service.js';
import { type PreparedUpload, UploadsService } from '../uploads/uploads.service.js';
import { BookingRepository } from './booking.repository.js';
import { LabOrdersRepository } from './lab-orders.repository.js';
import type { AnySlotsDto, CheckoutDto, CreateBookingDto } from './bookings.dto.js';
import { DispatchRepository, type EligibleListing } from './dispatch.repository.js';
import { type FeeBreakdown, feeBreakdown } from './fees.js';

export const PAYMENT_EXPIRY_JOB = 'payment_expiry';

interface LabCart {
  listing: EligibleListing;
  order: {
    collection: 'home' | 'walk_in';
    reportHours: number;
    items: { itemId: string; listingId: string; feePaise: number }[];
  };
}
const PAYMENT_MINUTES = 15;
const MINUTE = 60_000;

/** When the booking ends: one visit, or the last of `days` daily shifts. */
export function endOf(
  start: Date,
  listing: Pick<EligibleListing, 'kind' | 'durationMinutes'>,
  days: number,
): Date {
  const shiftDays = listing.kind === 'shift' ? days : 1;
  return new Date(
    start.getTime() + (shiftDays - 1) * 1440 * MINUTE + listing.durationMinutes * MINUTE,
  );
}

/**
 * Checkout (J3 and J4 to payment; BK-01, BK-02, BK-05, PY-01): validates the slot and holds it,
 * freezes the fee breakdown, stores the address and notes encrypted, and creates the gateway
 * order. The booking leaves Pending payment only on the signed webhook (PY-01).
 */
@Injectable()
export class CheckoutService {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    private readonly bookings: BookingRepository,
    private readonly dispatch: DispatchRepository,
    private readonly payments: PaymentsRepository,
    private readonly slots: SlotService,
    private readonly locks: SlotLocks,
    private readonly uploads: UploadsService,
    private readonly settings: Settings,
    private readonly jobs: JobRunner,
    private readonly audit: AuditService,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly labOrders: LabOrdersRepository,
  ) {}

  async create(
    principal: Principal,
    input: CreateBookingDto,
  ): Promise<{ bookingId: string; checkout: CheckoutDto }> {
    const candidates = await this.candidates(principal.userId, input);
    const free = await this.firstFree(candidates, input);
    await this.checkRecipient(principal.userId, input.recipientId);
    const cart = free.kind === 'lab_test' ? await this.labCart(free, input) : undefined;
    const listing = cart?.listing ?? free;
    if (listing.prescriptionRequired && !input.prescription)
      throw reason(BadRequestException, 'prescription_required');
    const days = listing.kind === 'shift' ? (input.shiftDays ?? 1) : 1;
    const fees = await this.quote(candidates, listing, days, input.listingId ? 'chosen' : 'any');
    const matching = input.listingId ? 'chosen' : 'any';
    if (
      matching === 'chosen' &&
      !(await this.locks.acquire(listing.providerId, input.startsAt, principal.userId))
    ) {
      throw reason(ConflictException, 'slot_taken');
    }
    const [address, notes, prescription] = await Promise.all([
      this.encryptor.encrypt(input.address, 'identity'),
      input.notes ? this.encryptor.encrypt(input.notes, 'health') : Promise.resolve(null),
      input.prescription
        ? this.uploads.prepare(principal.userId, 'booking_attachment', input.prescription)
        : Promise.resolve(undefined),
    ]);
    if (prescription?.verdict === 'infected') throw reason(BadRequestException, 'upload_infected');
    const bookingId = randomUUID();
    const { orderId } = await this.gateway.createOrder({
      amountPaise: fees.advancePaise,
      receipt: bookingId,
    });
    await this.save(principal.userId, bookingId, {
      input,
      listing,
      matching,
      days,
      fees,
      address,
      notes,
      prescription,
      orderId,
      cart,
    });
    return {
      bookingId,
      checkout: {
        orderId,
        amountPaise: fees.advancePaise,
        sandbox: 'sandboxCapture' in this.gateway,
      },
    };
  }

  /** Free times of any available provider for an item in a PIN code (A10). */
  async anySlots(query: { item: string; pin: string; gender?: string }): Promise<AnySlotsDto> {
    const item = await this.dispatch.itemByCode(query.item);
    if (!item) throw new NotFoundException();
    const listings = await this.dispatch.eligible({
      itemId: item.id,
      pin: query.pin,
      gender: query.gender ?? null,
    });
    const all = new Set<number>();
    for (const listing of listings) {
      const slots = await this.slots.slots({ ...this.slotRequest(listing), days: 7 });
      for (const slot of slots) all.add(slot.getTime());
    }
    const quotePaise = Math.max(
      0,
      ...listings.map((listing) => listing.feePaise + listing.travelPaise),
    );
    return {
      slots: [...all].sort((a, b) => a - b).map((time) => new Date(time)),
      quotePaise,
      providers: listings.length,
    };
  }

  /** A payment order for the rest of a shift booking's price (Q-ADVANCE). */
  async balanceCheckout(bookingId: string): Promise<CheckoutDto> {
    const booking = await this.bookings.find(bookingId);
    const due = booking ? booking.totalPaise - booking.paidPaise : 0;
    if (booking?.status !== 'confirmed' || due <= 0)
      throw reason(ConflictException, 'no_balance_due');
    const existing = (await this.payments.forBooking(bookingId)).find(
      (payment) => payment.purpose === 'balance',
    );
    const sandbox = 'sandboxCapture' in this.gateway;
    if (existing) return { orderId: existing.orderId, amountPaise: existing.amountPaise, sandbox };
    const { orderId } = await this.gateway.createOrder({
      amountPaise: due,
      receipt: `${bookingId}-balance`,
    });
    await this.payments.create(this.pool, {
      bookingId,
      purpose: 'balance',
      orderId,
      amountPaise: due,
    });
    return { orderId, amountPaise: due, sandbox };
  }

  private async candidates(bookerId: string, input: CreateBookingDto): Promise<EligibleListing[]> {
    if (Boolean(input.listingId) === Boolean(input.itemCode))
      throw reason(BadRequestException, 'listing_or_item');
    const item = input.itemCode ? await this.dispatch.itemByCode(input.itemCode) : undefined;
    if (input.itemCode && !item) throw new NotFoundException();
    const found = await this.dispatch.eligible({
      ...(input.listingId ? { listingId: input.listingId } : { itemId: item?.id ?? '' }),
      pin: input.pin,
      gender: input.genderPreference ?? null,
      bookerId,
    });
    if (found.length === 0) throw reason(ConflictException, 'no_provider');
    return found;
  }

  /** The first candidate that still offers the requested time (AV-02). */
  private async firstFree(
    candidates: readonly EligibleListing[],
    input: CreateBookingDto,
  ): Promise<EligibleListing> {
    for (const listing of candidates) {
      if (await this.slots.isOffered(this.slotRequest(listing), input.startsAt)) return listing;
    }
    throw reason(ConflictException, 'slot_taken');
  }

  /** The price before payment: the provider's own, or the highest of any who may take it (A10). */
  private async quote(
    candidates: readonly EligibleListing[],
    chosen: EligibleListing,
    days: number,
    matching: string,
  ): Promise<FeeBreakdown> {
    const priciest =
      matching === 'any'
        ? candidates.reduce((top, next) => (next.feePaise > top.feePaise ? next : top))
        : chosen;
    return this.fees(priciest, days);
  }

  async fees(listing: EligibleListing, days: number): Promise<FeeBreakdown> {
    const shift = listing.kind === 'shift';
    return feeBreakdown({
      unitFeePaise: listing.feePaise,
      travelPaise: shift ? 0 : listing.travelPaise,
      units: shift ? days : 1,
      commissionBps: await this.settings.get('commission_bps'),
      advancePercent: shift ? await this.settings.get('attendant_advance_percent') : 100,
    });
  }

  slotRequest(listing: EligibleListing) {
    return {
      providerId: listing.providerId,
      itemCode: listing.itemCode,
      durationMinutes: listing.durationMinutes,
      days: 14,
    };
  }

  /**
   * A lab cart (LB-02, LB-03): the chosen test plus more tests from the same lab, priced
   * together, with the home collection charge only for home collection.
   */
  private async labCart(first: EligibleListing, input: CreateBookingDto): Promise<LabCart> {
    const tests = [first];
    for (const listingId of new Set(input.extraListingIds ?? [])) {
      const [extra] = await this.dispatch.eligible({ listingId, pin: input.pin });
      if (extra?.providerId !== first.providerId || extra.kind !== 'lab_test')
        throw reason(BadRequestException, 'lab_cart_invalid');
      if (!tests.some((test) => test.itemId === extra.itemId)) tests.push(extra);
    }
    const collection = input.collection ?? 'home';
    const { rows } = await this.pool.query<{ hours: number }>(
      'SELECT coalesce(max(report_hours), 24)::int AS hours FROM app.catalogue_item WHERE id = ANY($1)',
      [tests.map((test) => test.itemId)],
    );
    return {
      listing: {
        ...first,
        feePaise: tests.reduce((sum, test) => sum + test.feePaise, 0),
        travelPaise: collection === 'home' ? first.travelPaise : 0,
        prescriptionRequired: tests.some((test) => test.prescriptionRequired),
      },
      order: {
        collection,
        reportHours: rows[0]?.hours ?? 24,
        items: tests.map((test) => ({
          itemId: test.itemId,
          listingId: test.listingId,
          feePaise: test.feePaise,
        })),
      },
    };
  }

  private async checkRecipient(bookerId: string, recipientId: string | undefined): Promise<void> {
    if (!recipientId) return;
    const { rows } = await this.pool.query(
      'SELECT 1 FROM app.linked_patient WHERE id = $1 AND owner_account_id = $2',
      [recipientId, bookerId],
    );
    if (rows.length === 0) throw new NotFoundException();
  }

  private async save(
    bookerId: string,
    bookingId: string,
    draft: {
      input: CreateBookingDto;
      listing: EligibleListing;
      matching: 'chosen' | 'any';
      days: number;
      fees: FeeBreakdown;
      address: Awaited<ReturnType<FieldEncryptor['encrypt']>>;
      notes: Awaited<ReturnType<FieldEncryptor['encrypt']>> | null;
      prescription: PreparedUpload | undefined;
      orderId: string;
      cart: LabCart | undefined;
    },
  ): Promise<void> {
    const { input, listing, matching } = draft;
    await this.bookings.transaction(async (client) => {
      if (draft.prescription) await this.uploads.record(client, draft.prescription);
      await this.bookings.insert(client, bookingId, {
        bookerId,
        linkedPatientId: input.recipientId ?? null,
        providerId: matching === 'chosen' ? listing.providerId : null,
        itemId: listing.itemId,
        listingId: matching === 'chosen' ? listing.listingId : null,
        matching,
        startsAt: input.startsAt,
        endsAt: endOf(input.startsAt, listing, draft.days),
        shiftDays: draft.days,
        pin: input.pin,
        address: draft.address,
        notes: draft.notes,
        genderPreference: input.genderPreference ?? null,
        fees: draft.fees,
        prescriptionObjectId: draft.prescription?.id ?? null,
      });
      if (draft.cart) await this.labOrders.create(client, { bookingId, ...draft.cart.order });
      await this.payments.create(client, {
        bookingId,
        purpose: 'booking',
        orderId: draft.orderId,
        amountPaise: draft.fees.advancePaise,
      });
      await this.jobs.enqueue(client, {
        kind: PAYMENT_EXPIRY_JOB,
        payload: { bookingId },
        runAt: new Date(Date.now() + PAYMENT_MINUTES * MINUTE),
        dedupeKey: `payment-expiry:${bookingId}`,
      });
      await this.audit.record(
        { action: 'booking.created', entity: 'booking', entityId: bookingId },
        client,
      );
    });
  }
}
