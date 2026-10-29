import { randomUUID } from 'node:crypto';
import type { EncryptedField } from '@heach/crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { type TransactionClient, withTransaction } from '../data-stores/transaction.js';
import type { Actor, BookingStatus, Transition } from './booking-transitions.js';
import type { FeeBreakdown } from './fees.js';

type Queryable = Pick<pg.Pool, 'query'>;

export interface BookingRow {
  id: string;
  bookerId: string;
  linkedPatientId: string | null;
  providerId: string | null;
  itemId: string;
  itemCode: string;
  service: string;
  kind: 'visit' | 'shift' | 'lab_test';
  prescriptionRequired: boolean;
  listingId: string | null;
  matching: 'chosen' | 'any';
  status: BookingStatus;
  cancelledBy: Actor | null;
  noShowParty: 'patient' | 'provider' | null;
  statusReason: string | null;
  startsAt: Date;
  endsAt: Date;
  shiftDays: number;
  pin: string;
  address: EncryptedField;
  notes: EncryptedField | null;
  genderPreference: 'female' | 'male' | null;
  feePaise: number;
  travelPaise: number;
  discountPaise: number;
  totalPaise: number;
  commissionPaise: number;
  advancePaise: number;
  paidPaise: number;
  refundedPaise: number;
  acceptBy: Date | null;
  prescriptionObjectId: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
  completedAt: Date | null;
}

export interface NewBooking {
  bookerId: string;
  linkedPatientId: string | null;
  providerId: string | null;
  itemId: string;
  listingId: string | null;
  matching: 'chosen' | 'any';
  startsAt: Date;
  endsAt: Date;
  shiftDays: number;
  pin: string;
  address: EncryptedField;
  notes: EncryptedField | null;
  genderPreference: 'female' | 'male' | null;
  fees: FeeBreakdown;
  prescriptionObjectId: string | null;
}

export const BOOKING_COLUMNS = `b.id, b.booker_account_id AS "bookerId", b.linked_patient_id AS "linkedPatientId",
  b.provider_account_id AS "providerId", b.item_id AS "itemId", i.code AS "itemCode", i.service, i.kind,
  i.prescription_required AS "prescriptionRequired", b.listing_id AS "listingId", b.matching, b.status,
  b.cancelled_by AS "cancelledBy", b.no_show_party AS "noShowParty", b.status_reason AS "statusReason",
  b.starts_at AS "startsAt", b.ends_at AS "endsAt", b.shift_days AS "shiftDays", b.pin, b.address, b.notes,
  b.gender_preference AS "genderPreference", b.fee_paise AS "feePaise", b.travel_paise AS "travelPaise",
  b.discount_paise AS "discountPaise", b.total_paise AS "totalPaise", b.commission_paise AS "commissionPaise",
  b.advance_paise AS "advancePaise", b.paid_paise AS "paidPaise", b.refunded_paise AS "refundedPaise",
  b.accept_by AS "acceptBy", b.prescription_object_id AS "prescriptionObjectId", b.created_at AS "createdAt",
  b.confirmed_at AS "confirmedAt", b.completed_at AS "completedAt"`;

const FROM = 'FROM app.booking b JOIN app.catalogue_item i ON i.id = b.item_id';

/** Bookings and their history (BK-01, BK-02). Callers check who may see each row (SE-01). */
@Injectable()
export class BookingRepository {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  transaction<T>(work: (client: TransactionClient) => Promise<T>): Promise<T> {
    return withTransaction(this.pool, work);
  }

  async insert(client: TransactionClient, id: string, booking: NewBooking): Promise<void> {
    const f = booking.fees;
    await client.query(
      `INSERT INTO app.booking (id, booker_account_id, linked_patient_id, provider_account_id, item_id,
         listing_id, matching, status, starts_at, ends_at, shift_days, pin, address, notes,
         gender_preference, fee_paise, travel_paise, discount_paise, total_paise, commission_paise,
         advance_paise, prescription_object_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_payment', $8, $9, $10, $11, $12, $13, $14, $15,
         $16, $17, $18, $19, $20, $21)`,
      [
        id,
        booking.bookerId,
        booking.linkedPatientId,
        booking.providerId,
        booking.itemId,
        booking.listingId,
        booking.matching,
        booking.startsAt,
        booking.endsAt,
        booking.shiftDays,
        booking.pin,
        booking.address,
        booking.notes,
        booking.genderPreference,
        f.feePaise,
        f.travelPaise,
        f.discountPaise,
        f.totalPaise,
        f.commissionPaise,
        f.advancePaise,
        booking.prescriptionObjectId,
      ],
    );
  }

  async find(id: string, client: Queryable = this.pool): Promise<BookingRow | undefined> {
    const { rows } = await client.query<BookingRow>(
      `SELECT ${BOOKING_COLUMNS} ${FROM} WHERE b.id = $1`,
      [id],
    );
    return rows[0];
  }

  async lock(client: TransactionClient, id: string): Promise<BookingRow | undefined> {
    await client.query('SELECT 1 FROM app.booking WHERE id = $1 FOR UPDATE', [id]);
    return this.find(id, client);
  }

  /** Applies a state-machine transition and records it (BK-02). */
  async transition(
    client: TransactionClient,
    booking: Pick<BookingRow, 'id' | 'status'>,
    change: Transition,
    actor: { id: string | null; role: string },
    reason: string | null,
  ): Promise<void> {
    await client.query(
      `UPDATE app.booking SET status = $2,
              cancelled_by = CASE WHEN $2 = 'cancelled' THEN $3 ELSE cancelled_by END,
              no_show_party = CASE WHEN $2 = 'no_show' THEN $4 ELSE no_show_party END,
              status_reason = coalesce($5, status_reason),
              confirmed_at = CASE WHEN $2 = 'confirmed' THEN now() ELSE confirmed_at END,
              completed_at = CASE WHEN $2 = 'completed' THEN now() ELSE completed_at END
        WHERE id = $1`,
      [booking.id, change.to, change.cancelledBy ?? null, change.noShowParty ?? null, reason],
    );
    await client.query(
      `INSERT INTO app.booking_event (id, booking_id, from_status, to_status, reason, actor_id, actor_role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), booking.id, booking.status, change.to, reason, actor.id, actor.role],
    );
  }

  async setAcceptBy(client: TransactionClient, id: string, acceptBy: Date): Promise<void> {
    await client.query('UPDATE app.booking SET accept_by = $2 WHERE id = $1', [id, acceptBy]);
  }

  async addPaid(client: TransactionClient, id: string, paise: number): Promise<void> {
    await client.query('UPDATE app.booking SET paid_paise = paid_paise + $2 WHERE id = $1', [
      id,
      paise,
    ]);
  }

  async addRefunded(client: TransactionClient, id: string, paise: number): Promise<void> {
    await client.query(
      'UPDATE app.booking SET refunded_paise = refunded_paise + $2 WHERE id = $1',
      [id, paise],
    );
  }

  /** Binds the accepting provider and their prices (amendment A10). */
  async assign(
    client: TransactionClient,
    id: string,
    assignment: { providerId: string; listingId: string; fees: FeeBreakdown },
  ): Promise<void> {
    const f = assignment.fees;
    await client.query(
      `UPDATE app.booking SET provider_account_id = $2, listing_id = $3, fee_paise = $4, travel_paise = $5,
              total_paise = $6, commission_paise = $7, advance_paise = $8 WHERE id = $1`,
      [
        id,
        assignment.providerId,
        assignment.listingId,
        f.feePaise,
        f.travelPaise,
        f.totalPaise,
        f.commissionPaise,
        f.advancePaise,
      ],
    );
  }

  /** Moves a booking to another provider (AD-05 reassign, A13 replacement), recorded as an event. */
  async reassign(
    client: TransactionClient,
    booking: Pick<BookingRow, 'id' | 'status'>,
    to: { providerId: string; listingId: string },
    actor: { id: string | null; role: string },
  ): Promise<void> {
    await client.query(
      'UPDATE app.booking SET provider_account_id = $2, listing_id = $3 WHERE id = $1',
      [booking.id, to.providerId, to.listingId],
    );
    await client.query(
      `INSERT INTO app.booking_event (id, booking_id, from_status, to_status, reason, actor_id, actor_role)
       VALUES ($1, $2, $3, $3, 'reassigned', $4, $5)`,
      [randomUUID(), booking.id, booking.status, actor.id, actor.role],
    );
  }

  /** Whether the provider has another live booking overlapping this time. */
  async providerBusy(
    client: Queryable,
    providerId: string,
    interval: { start: Date; end: Date },
    exceptId?: string,
  ): Promise<boolean> {
    const { rows } = await client.query<{ busy: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM app.booking WHERE provider_account_id = $1 AND id <> coalesce($4, '00000000-0000-4000-8000-000000000000'::uuid)
         AND status IN ('requested', 'confirmed', 'in_progress') AND starts_at < $3 AND ends_at > $2) AS busy`,
      [providerId, interval.start, interval.end, exceptId ?? null],
    );
    return rows[0]?.busy ?? false;
  }

  async events(id: string) {
    const { rows } = await this.pool.query<{
      fromStatus: string;
      toStatus: string;
      reason: string | null;
      actorRole: string;
      createdAt: Date;
    }>(
      `SELECT from_status AS "fromStatus", to_status AS "toStatus", reason, actor_role AS "actorRole",
              created_at AS "createdAt" FROM app.booking_event WHERE booking_id = $1 ORDER BY created_at`,
      [id],
    );
    return rows;
  }

  async forBooker(bookerId: string): Promise<BookingRow[]> {
    const { rows } = await this.pool.query<BookingRow>(
      `SELECT ${BOOKING_COLUMNS} ${FROM} WHERE b.booker_account_id = $1 ORDER BY b.starts_at DESC LIMIT 100`,
      [bookerId],
    );
    return rows;
  }

  async forProvider(providerId: string): Promise<BookingRow[]> {
    const { rows } = await this.pool.query<BookingRow>(
      `SELECT ${BOOKING_COLUMNS} ${FROM} WHERE b.provider_account_id = $1 AND b.status <> 'pending_payment'
        ORDER BY b.starts_at DESC LIMIT 100`,
      [providerId],
    );
    return rows;
  }

  async search(filter: { status?: string; from?: Date }, limit = 100): Promise<BookingRow[]> {
    const { rows } = await this.pool.query<BookingRow>(
      `SELECT ${BOOKING_COLUMNS} ${FROM} WHERE ($1::text IS NULL OR b.status = $1)
          AND ($2::timestamptz IS NULL OR b.starts_at >= $2)
        ORDER BY b.created_at DESC LIMIT $3`,
      [filter.status ?? null, filter.from ?? null, limit],
    );
    return rows;
  }
}
