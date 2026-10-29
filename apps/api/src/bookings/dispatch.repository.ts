import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import type { TransactionClient } from '../data-stores/transaction.js';

type Queryable = Pick<pg.Pool, 'query'>;

export interface EligibleListing {
  listingId: string;
  providerId: string;
  itemId: string;
  itemCode: string;
  kind: 'visit' | 'shift' | 'lab_test';
  prescriptionRequired: boolean;
  feePaise: number;
  durationMinutes: number;
  travelPaise: number;
  pastVisits: number;
}

export interface OfferRow {
  id: string;
  bookingId: string;
  providerId: string;
  listingId: string;
  wave: number;
  status: 'offered' | 'accepted' | 'declined' | 'expired' | 'withdrawn';
}

/** Listings that may take a booking, and the offers sent for it (BK-03, amendment A10). */
@Injectable()
export class DispatchRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>) {}

  /**
   * Published listings of an item that serve the PIN code, from Approved, active providers, with
   * the gender asked for; ranked by earlier care of this booker, then fee (A10).
   */
  async eligible(
    filter: {
      itemId?: string;
      listingId?: string;
      pin: string;
      gender?: string | null;
      bookerId?: string;
    },
    client: Queryable = this.pool,
  ): Promise<EligibleListing[]> {
    const { rows } = await client.query<EligibleListing>(
      `SELECT l.id AS "listingId", l.provider_account_id AS "providerId", i.id AS "itemId", i.code AS "itemCode",
              i.kind, i.prescription_required AS "prescriptionRequired", l.fee_paise AS "feePaise",
              l.duration_minutes AS "durationMinutes", coalesce(s.travel_surcharge_paise, 0) AS "travelPaise",
              (SELECT count(*)::int FROM app.booking pb WHERE pb.provider_account_id = l.provider_account_id
                  AND pb.booker_account_id = $5 AND pb.status = 'completed') AS "pastVisits"
         FROM app.listing l
         JOIN app.catalogue_item i ON i.id = l.item_id AND i.active
         JOIN app.role_assignment r ON r.account_id = l.provider_account_id AND r.side = 'provider'
              AND r.application_status = 'approved'
         JOIN app.account a ON a.id = l.provider_account_id AND a.status = 'active'
         JOIN app.account_profile p ON p.account_id = l.provider_account_id
         LEFT JOIN app.provider_schedule s ON s.account_id = l.provider_account_id
        WHERE l.active AND ($1::uuid IS NULL OR i.id = $1) AND ($2::uuid IS NULL OR l.id = $2)
          AND EXISTS (SELECT 1 FROM app.service_area sa JOIN app.pin_code pc ON pc.pin = sa.pin
                       WHERE sa.account_id = l.provider_account_id AND sa.pin = $3 AND pc.serviceable)
          AND ($4::text IS NULL OR p.gender = $4)
        ORDER BY "pastVisits" DESC, l.fee_paise, l.provider_account_id
        LIMIT 100`,
      [
        filter.itemId ?? null,
        filter.listingId ?? null,
        filter.pin,
        filter.gender ?? null,
        filter.bookerId ?? null,
      ],
    );
    return rows;
  }

  async itemByCode(code: string): Promise<{ id: string; code: string } | undefined> {
    const { rows } = await this.pool.query<{ id: string; code: string }>(
      'SELECT id, code FROM app.catalogue_item WHERE code = $1 AND active',
      [code],
    );
    return rows[0];
  }

  async offers(client: Queryable | undefined, bookingId: string): Promise<OfferRow[]> {
    const { rows } = await (client ?? this.pool).query<OfferRow>(
      `SELECT id, booking_id AS "bookingId", provider_account_id AS "providerId", listing_id AS "listingId", wave, status
         FROM app.booking_offer WHERE booking_id = $1 ORDER BY wave, offered_at`,
      [bookingId],
    );
    return rows;
  }

  async offer(
    client: TransactionClient,
    offer: { bookingId: string; providerId: string; listingId: string; wave: number },
  ) {
    await client.query(
      `INSERT INTO app.booking_offer (id, booking_id, provider_account_id, listing_id, wave) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (booking_id, provider_account_id) DO NOTHING`,
      [randomUUID(), offer.bookingId, offer.providerId, offer.listingId, offer.wave],
    );
  }

  async respond(
    client: TransactionClient,
    bookingId: string,
    providerId: string,
    response: { status: 'accepted' | 'declined'; reason?: string | null },
  ): Promise<boolean> {
    const result = await client.query(
      `UPDATE app.booking_offer SET status = $3, decline_reason = $4, responded_at = now()
        WHERE booking_id = $1 AND provider_account_id = $2 AND status = 'offered'`,
      [bookingId, providerId, response.status, response.reason ?? null],
    );
    return result.rowCount === 1;
  }

  /** Closes every other open offer of the booking. */
  async closeOthers(client: TransactionClient, bookingId: string, status: 'withdrawn' | 'expired') {
    await client.query(
      `UPDATE app.booking_offer SET status = $2, responded_at = now() WHERE booking_id = $1 AND status = 'offered'`,
      [bookingId, status],
    );
  }

  /** Open offers to this provider, newest first. */
  async openFor(providerId: string): Promise<{ bookingId: string; listingId: string }[]> {
    const { rows } = await this.pool.query<{ bookingId: string; listingId: string }>(
      `SELECT o.booking_id AS "bookingId", o.listing_id AS "listingId" FROM app.booking_offer o
         JOIN app.booking b ON b.id = o.booking_id AND b.status = 'requested'
        WHERE o.provider_account_id = $1 AND o.status = 'offered' ORDER BY o.offered_at DESC LIMIT 50`,
      [providerId],
    );
    return rows;
  }

  async listing(
    listingId: string,
    client: Queryable = this.pool,
  ): Promise<EligibleListing | undefined> {
    const { rows } = await client.query<EligibleListing>(
      `SELECT l.id AS "listingId", l.provider_account_id AS "providerId", i.id AS "itemId", i.code AS "itemCode", i.kind,
              i.prescription_required AS "prescriptionRequired", l.fee_paise AS "feePaise",
              l.duration_minutes AS "durationMinutes", coalesce(s.travel_surcharge_paise, 0) AS "travelPaise", 0 AS "pastVisits"
         FROM app.listing l JOIN app.catalogue_item i ON i.id = l.item_id
         LEFT JOIN app.provider_schedule s ON s.account_id = l.provider_account_id
        WHERE l.id = $1`,
      [listingId],
    );
    return rows[0];
  }
}
