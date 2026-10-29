import type { FieldEncryptor } from '@heach/crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type pg from 'pg';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../adapters/payments.port.js';
import { AuditService } from '../audit/audit.service.js';
import { maskName } from '../admin/masking.js';
import type { Plain } from '../common/plain.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { PaymentsRepository } from '../payments/payments.repository.js';
import { Settings } from '../settings/settings.service.js';
import { BookingRepository, type BookingRow } from './booking.repository.js';
import type {
  BookingDto,
  BookingSummaryDto,
  ProviderBookingDto,
  ProviderRequestDto,
} from './bookings.dto.js';
import { CancellationService } from './cancellation.service.js';
import { DispatchRepository } from './dispatch.repository.js';
import { providerEarning } from './fees.js';

const CANCELLABLE = new Set(['pending_payment', 'requested', 'confirmed']);
const PROVIDER_SEES_ADDRESS = new Set(['confirmed', 'in_progress', 'completed', 'no_show']);

/**
 * What each party sees of a booking (SE-01, HS-02): the booker sees everything about their own
 * booking; a provider sees the address and contact only once confirmed; an admin sees masked
 * names and no Restricted data. Every Restricted read is audited (SE-05).
 */
@Injectable()
export class BookingViews {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>,
    private readonly bookings: BookingRepository,
    private readonly payments: PaymentsRepository,
    private readonly dispatch: DispatchRepository,
    private readonly cancellation: CancellationService,
    private readonly audit: AuditService,
    private readonly settings: Settings,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async forBooker(bookerId: string, bookingId: string, locale: string): Promise<BookingDto> {
    const booking = await this.bookings.find(bookingId);
    if (booking?.bookerId !== bookerId) throw new NotFoundException();
    const [summary, events, refunds, payments, address, notes] = await Promise.all([
      this.summary(booking, locale),
      this.bookings.events(bookingId),
      this.payments.refunds(bookingId),
      this.payments.forBooking(bookingId),
      this.encryptor.decrypt(booking.address),
      booking.notes ? this.encryptor.decrypt(booking.notes) : Promise.resolve(null),
    ]);
    await this.audit.record({ action: 'booking.read', entity: 'booking', entityId: bookingId });
    const unpaid = payments.find((payment) => payment.status === 'created');
    return {
      ...summary,
      address,
      notes,
      events,
      refunds: refunds.map(({ amountPaise, reason, status }) => ({ amountPaise, reason, status })),
      canCancel: CANCELLABLE.has(booking.status),
      refundIfCancelledPaise: await this.cancellation.refundIfCancelled(booking, 'patient'),
      checkout: unpaid
        ? {
            orderId: unpaid.orderId,
            amountPaise: unpaid.amountPaise,
            sandbox: 'sandboxCapture' in this.gateway,
          }
        : null,
      hasPrescription: booking.prescriptionObjectId !== null,
    };
  }

  async listForBooker(bookerId: string, locale: string): Promise<BookingSummaryDto[]> {
    return Promise.all(
      (await this.bookings.forBooker(bookerId)).map((booking) => this.summary(booking, locale)),
    );
  }

  async requests(providerId: string, locale: string): Promise<ProviderRequestDto[]> {
    const open = await this.dispatch.openFor(providerId);
    const views = await Promise.all(
      open.map((offer) => this.request(offer.bookingId, offer.listingId, locale)),
    );
    return views.filter((view): view is ProviderRequestDto => view !== undefined);
  }

  async forProvider(
    providerId: string,
    bookingId: string,
    locale: string,
  ): Promise<ProviderBookingDto> {
    const booking = await this.bookings.find(bookingId);
    if (booking?.providerId !== providerId || booking.status === 'requested')
      throw new NotFoundException();
    return this.providerView(booking, locale);
  }

  async listForProvider(providerId: string, locale: string): Promise<BookingSummaryDto[]> {
    const rows = (await this.bookings.forProvider(providerId)).filter(
      (booking) => booking.status !== 'requested',
    );
    return Promise.all(rows.map((booking) => this.summary(booking, locale)));
  }

  /** Admin console rows (AD-05): masked names, no address or notes. */
  async forAdmin(booking: BookingRow): Promise<Plain<BookingSummaryDto>> {
    const summary = await this.summary(booking, 'en');
    const provider = summary.provider;
    return {
      ...summary,
      recipientName: maskName(summary.recipientName) ?? '—',
      provider: provider ? { id: provider.id, name: maskName(provider.name) ?? '—' } : null,
    };
  }

  async summary(booking: BookingRow, locale: string): Promise<Plain<BookingSummaryDto>> {
    const { rows } = await this.pool.query<{
      itemName: string;
      providerName: string | null;
      recipientName: string | null;
    }>(
      `SELECT (SELECT name FROM app.catalogue_item_text WHERE item_id = $1 AND locale = $2) AS "itemName",
              (SELECT coalesce(o.name, p.full_name) FROM app.account_profile p
                 LEFT JOIN app.organisation o ON o.owner_account_id = p.account_id WHERE p.account_id = $3) AS "providerName",
              coalesce((SELECT full_name FROM app.linked_patient WHERE id = $4),
                       (SELECT full_name FROM app.account_profile WHERE account_id = $5)) AS "recipientName"`,
      [booking.itemId, locale, booking.providerId, booking.linkedPatientId, booking.bookerId],
    );
    const names = rows[0];
    return {
      id: booking.id,
      status: booking.status,
      cancelledBy: booking.cancelledBy,
      noShowParty: booking.noShowParty,
      statusReason: booking.statusReason,
      service: booking.service,
      itemCode: booking.itemCode,
      itemName: names?.itemName ?? booking.itemCode,
      kind: booking.kind,
      matching: booking.matching,
      listingId: booking.listingId,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      shiftDays: booking.shiftDays,
      pin: booking.pin,
      provider: booking.providerId
        ? { id: booking.providerId, name: names?.providerName ?? '' }
        : null,
      recipientName: names?.recipientName ?? '',
      fees: {
        feePaise: booking.feePaise,
        travelPaise: booking.travelPaise,
        discountPaise: booking.discountPaise,
        totalPaise: booking.totalPaise,
        advancePaise: booking.advancePaise,
        paidPaise: booking.paidPaise,
        refundedPaise: booking.refundedPaise,
        balanceDuePaise: ['confirmed', 'in_progress'].includes(booking.status)
          ? Math.max(0, booking.totalPaise - booking.paidPaise)
          : 0,
      },
      acceptBy: booking.acceptBy,
    };
  }

  private async request(
    bookingId: string,
    listingId: string,
    locale: string,
  ): Promise<ProviderRequestDto | undefined> {
    const [booking, listing] = await Promise.all([
      this.bookings.find(bookingId),
      this.dispatch.listing(listingId),
    ]);
    if (!booking || !listing) return undefined;
    const summary = await this.summary(booking, locale);
    const notes = booking.notes ? await this.encryptor.decrypt(booking.notes) : null;
    if (notes)
      await this.audit.record({
        action: 'booking.notes.read',
        entity: 'booking',
        entityId: bookingId,
      });
    const units = listing.kind === 'shift' ? booking.shiftDays : 1;
    const fee = listing.feePaise * units;
    const travel = listing.kind === 'shift' ? 0 : listing.travelPaise;
    const commissionPaise = Math.round(
      (fee * (await this.settings.get('commission_bps'))) / 10_000,
    );
    return {
      bookingId,
      itemName: summary.itemName,
      kind: booking.kind,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      shiftDays: booking.shiftDays,
      pin: booking.pin,
      notes,
      hasPrescription: booking.prescriptionObjectId !== null,
      earningPaise: providerEarning({
        feePaise: fee,
        travelPaise: travel,
        commissionPaise,
        discountPaise: 0,
      }),
      acceptBy: booking.acceptBy,
    };
  }

  private async providerView(booking: BookingRow, locale: string): Promise<ProviderBookingDto> {
    const summary = await this.summary(booking, locale);
    const visible = PROVIDER_SEES_ADDRESS.has(booking.status);
    const [address, notes, contactMobile] = visible
      ? await Promise.all([
          this.encryptor.decrypt(booking.address),
          booking.notes ? this.encryptor.decrypt(booking.notes) : Promise.resolve(null),
          this.bookerMobile(booking.bookerId),
        ])
      : [null, null, null];
    if (visible)
      await this.audit.record({
        action: 'booking.provider_read',
        entity: 'booking',
        entityId: booking.id,
      });
    return {
      ...summary,
      address,
      notes,
      contactMobile,
      hasPrescription: booking.prescriptionObjectId !== null,
      earningPaise: providerEarning(booking),
    };
  }

  private async bookerMobile(bookerId: string): Promise<string | null> {
    const { rows } = await this.pool.query<{
      mobile: Parameters<FieldEncryptor['decrypt']>[0] | null;
    }>('SELECT mobile FROM app.account WHERE id = $1', [bookerId]);
    const mobile = rows[0]?.mobile;
    return mobile ? this.encryptor.decrypt(mobile) : null;
  }
}
