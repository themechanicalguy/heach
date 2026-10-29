import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type pg from 'pg';
import { reason } from '../common/error-response.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import type { EligibleListing } from './dispatch.repository.js';
import type { FeeBreakdown } from './fees.js';

export interface Discount {
  entitlementId: string | null;
  units: number;
  entitlementPaise: number;
  couponId: string | null;
  couponPaise: number;
}

export const NO_DISCOUNT: Discount = {
  entitlementId: null,
  units: 0,
  entitlementPaise: 0,
  couponId: null,
  couponPaise: 0,
};

interface EntitlementRow {
  id: string;
  left: number;
  discount_percent: number;
}

/**
 * Plan entitlements and coupons at checkout (BK-08, PK-04, RR-08). An entitlement covers the
 * fee of the units it has left, or gives its discount once they are used; one coupon then takes
 * up to its value off what is left. Both are drawn in the booking's transaction under guards
 * that never let use exceed what was bought (TS-09), and are given back if the booking is
 * cancelled before it happens.
 */
@Injectable()
export class DiscountsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>) {}

  async quote(
    bookerId: string,
    input: { purchaseId?: string | undefined; couponId?: string | undefined },
    listing: EligibleListing,
    fees: FeeBreakdown,
    units: number,
  ): Promise<Discount> {
    const discount = { ...NO_DISCOUNT };
    if (input.purchaseId) {
      const entitlement = await this.entitlement(bookerId, input.purchaseId, listing);
      if (!entitlement) throw reason(ConflictException, 'entitlement_unavailable');
      discount.entitlementId = entitlement.id;
      if (entitlement.left >= units) {
        discount.units = units;
        discount.entitlementPaise = fees.feePaise;
      } else if (entitlement.discount_percent > 0) {
        discount.entitlementPaise = Math.round(
          (fees.feePaise * entitlement.discount_percent) / 100,
        );
      } else {
        throw reason(ConflictException, 'entitlement_unavailable');
      }
    }
    if (input.couponId) {
      const value = await this.couponValue(bookerId, input.couponId);
      discount.couponId = input.couponId;
      discount.couponPaise = Math.min(value, fees.totalPaise - discount.entitlementPaise);
    }
    return discount;
  }

  /** The fee breakdown with the discount taken off; the advance follows the new total. */
  apply(fees: FeeBreakdown, discount: Discount, advancePercent: number): FeeBreakdown {
    const discountPaise = discount.entitlementPaise + discount.couponPaise;
    const totalPaise = fees.totalPaise - discountPaise;
    return {
      ...fees,
      discountPaise,
      totalPaise,
      advancePaise: Math.round((totalPaise * advancePercent) / 100),
    };
  }

  /** Draws the entitlement and uses the coupon, in the booking's transaction. */
  async draw(client: TransactionClient, bookingId: string, discount: Discount): Promise<void> {
    if (discount.entitlementId) {
      const used = await client.query(
        'UPDATE app.entitlement SET units_used = units_used + $2 WHERE id = $1 AND units_used + $2 <= units_total',
        [discount.entitlementId, discount.units],
      );
      if (used.rowCount !== 1) throw reason(ConflictException, 'entitlement_unavailable');
      await client.query(
        'INSERT INTO app.entitlement_use (id, entitlement_id, booking_id, units, value_paise) VALUES ($1, $2, $3, $4, $5)',
        [
          randomUUID(),
          discount.entitlementId,
          bookingId,
          Math.max(discount.units, 1),
          discount.entitlementPaise,
        ],
      );
    }
    if (discount.couponId) {
      const coupon = await client.query(
        `UPDATE app.coupon SET status = 'used', used_booking_id = $2 WHERE id = $1 AND status = 'active' AND expires_at > now()`,
        [discount.couponId, bookingId],
      );
      if (coupon.rowCount !== 1) throw reason(ConflictException, 'coupon_unavailable');
      await client.query('UPDATE app.booking SET coupon_id = $2 WHERE id = $1', [
        bookingId,
        discount.couponId,
      ]);
    }
  }

  /** Gives back what a cancelled booking drew (the units, and the coupon if still valid). */
  async giveBack(client: TransactionClient, bookingId: string): Promise<void> {
    const { rows } = await client.query<{ entitlement_id: string; units: number }>(
      `UPDATE app.entitlement_use SET reversed_at = now() WHERE booking_id = $1 AND reversed_at IS NULL
       RETURNING entitlement_id, units`,
      [bookingId],
    );
    for (const row of rows) {
      await client.query(
        'UPDATE app.entitlement SET units_used = greatest(units_used - $2, 0) WHERE id = $1',
        [row.entitlement_id, row.units],
      );
    }
    await client.query(
      `UPDATE app.coupon SET status = 'active', used_booking_id = NULL WHERE used_booking_id = $1 AND expires_at > now()`,
      [bookingId],
    );
  }

  private async entitlement(
    bookerId: string,
    purchaseId: string,
    listing: EligibleListing,
  ): Promise<EntitlementRow | undefined> {
    const { rows } = await this.pool.query<EntitlementRow>(
      `SELECT e.id, e.units_total - e.units_used AS left, e.discount_percent
         FROM app.entitlement e JOIN app.plan_purchase pp ON pp.id = e.purchase_id
         JOIN app.catalogue_item i ON i.id = $3
        WHERE pp.id = $1 AND pp.buyer_account_id = $2 AND pp.status = 'active' AND pp.ends_at > now()
          AND (e.item_id = i.id OR (e.item_id IS NULL AND e.service = i.service))
          AND (e.provider_account_id IS NULL OR e.provider_account_id = $4)
        ORDER BY (e.units_total - e.units_used) DESC LIMIT 1`,
      [purchaseId, bookerId, listing.itemId, listing.providerId],
    );
    return rows[0];
  }

  private async couponValue(bookerId: string, couponId: string): Promise<number> {
    const { rows } = await this.pool.query<{ value_paise: number }>(
      `SELECT value_paise FROM app.coupon WHERE id = $1 AND account_id = $2 AND status = 'active' AND expires_at > now()`,
      [couponId, bookerId],
    );
    const value = rows[0]?.value_paise;
    if (value === undefined) throw new NotFoundException();
    return value;
  }
}
