import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import type { TransactionClient } from '../data-stores/transaction.js';

type Queryable = Pick<pg.Pool, 'query'>;

export interface PaymentRow {
  id: string;
  /** The booking paid for, or null for a plan purchase (then `purchaseId` is set). */
  bookingId: string | null;
  purchaseId: string | null;
  purpose: 'booking' | 'balance' | 'plan';
  orderId: string;
  gatewayPaymentId: string | null;
  amountPaise: number;
  status: 'created' | 'paid' | 'failed';
  refundedPaise: number;
}

/** Whose refunds to send: a booking's, or a plan purchase's. */
export interface RefundOwner {
  kind: 'booking' | 'purchase';
  id: string;
}

export interface RefundRow {
  id: string;
  bookingId: string;
  paymentId: string;
  gatewayPaymentId: string | null;
  amountPaise: number;
  reason: string;
  status: 'pending' | 'processed' | 'failed';
  createdAt: Date;
}

const PAYMENT_COLUMNS = `p.id, p.booking_id AS "bookingId", p.purchase_id AS "purchaseId", p.purpose, p.gateway_order_id AS "orderId",
  p.gateway_payment_id AS "gatewayPaymentId", p.amount_paise AS "amountPaise", p.status,
  coalesce((SELECT sum(r.amount_paise) FROM app.refund r WHERE r.payment_id = p.id AND r.status <> 'failed'), 0)::float8 AS "refundedPaise"`;

/** Gateway payments, webhook events and refunds (PY-01, PY-02). */
@Injectable()
export class PaymentsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async create(
    client: Queryable,
    payment: {
      bookingId: string;
      purpose: 'booking' | 'balance';
      orderId: string;
      amountPaise: number;
    },
  ): Promise<string> {
    const id = randomUUID();
    await client.query(
      `INSERT INTO app.payment (id, booking_id, purpose, gateway_order_id, amount_paise) VALUES ($1, $2, $3, $4, $5)`,
      [id, payment.bookingId, payment.purpose, payment.orderId, payment.amountPaise],
    );
    return id;
  }

  async byOrder(orderId: string, client: Queryable = this.pool): Promise<PaymentRow | undefined> {
    const { rows } = await client.query<PaymentRow>(
      `SELECT ${PAYMENT_COLUMNS} FROM app.payment p WHERE p.gateway_order_id = $1`,
      [orderId],
    );
    return rows[0];
  }

  async forBooking(bookingId: string, client: Queryable = this.pool): Promise<PaymentRow[]> {
    const { rows } = await client.query<PaymentRow>(
      `SELECT ${PAYMENT_COLUMNS} FROM app.payment p WHERE p.booking_id = $1 ORDER BY p.created_at`,
      [bookingId],
    );
    return rows;
  }

  async createForPurchase(
    client: Queryable,
    payment: { purchaseId: string; orderId: string; amountPaise: number },
  ): Promise<string> {
    const id = randomUUID();
    await client.query(
      `INSERT INTO app.payment (id, purchase_id, purpose, gateway_order_id, amount_paise) VALUES ($1, $2, 'plan', $3, $4)`,
      [id, payment.purchaseId, payment.orderId, payment.amountPaise],
    );
    return id;
  }

  async forPurchase(purchaseId: string, client: Queryable = this.pool): Promise<PaymentRow[]> {
    const { rows } = await client.query<PaymentRow>(
      `SELECT ${PAYMENT_COLUMNS} FROM app.payment p WHERE p.purchase_id = $1 ORDER BY p.created_at`,
      [purchaseId],
    );
    return rows;
  }

  async insertPurchaseRefund(
    client: TransactionClient,
    refund: {
      purchaseId: string;
      paymentId: string;
      amountPaise: number;
      reason: string;
      actorRole: string;
    },
  ): Promise<string> {
    const id = randomUUID();
    await client.query(
      `INSERT INTO app.refund (id, purchase_id, payment_id, amount_paise, reason, actor_role) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        refund.purchaseId,
        refund.paymentId,
        refund.amountPaise,
        refund.reason,
        refund.actorRole,
      ],
    );
    return id;
  }

  /** Records a webhook event once; false when it was seen before (duplicate delivery). */
  async firstDelivery(client: TransactionClient, eventId: string, kind: string): Promise<boolean> {
    const result = await client.query(
      'INSERT INTO app.payment_event (gateway_event_id, kind) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [eventId, kind],
    );
    return result.rowCount === 1;
  }

  async markPaid(
    client: TransactionClient,
    id: string,
    gatewayPaymentId: string,
  ): Promise<boolean> {
    const result = await client.query(
      `UPDATE app.payment SET status = 'paid', gateway_payment_id = $2, paid_at = now()
        WHERE id = $1 AND status <> 'paid'`,
      [id, gatewayPaymentId],
    );
    return result.rowCount === 1;
  }

  async markFailed(client: TransactionClient, id: string): Promise<void> {
    await client.query(
      `UPDATE app.payment SET status = 'failed' WHERE id = $1 AND status = 'created'`,
      [id],
    );
  }

  async insertRefund(
    client: TransactionClient,
    refund: {
      bookingId: string;
      paymentId: string;
      amountPaise: number;
      reason: string;
      actorRole: string;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO app.refund (id, booking_id, payment_id, amount_paise, reason, actor_role) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        refund.bookingId,
        refund.paymentId,
        refund.amountPaise,
        refund.reason,
        refund.actorRole,
      ],
    );
  }

  async refunds(bookingId: string, client: Queryable = this.pool): Promise<RefundRow[]> {
    const { rows } = await client.query<RefundRow>(
      `SELECT r.id, r.booking_id AS "bookingId", r.payment_id AS "paymentId", p.gateway_payment_id AS "gatewayPaymentId",
              r.amount_paise AS "amountPaise", r.reason, r.status, r.created_at AS "createdAt"
         FROM app.refund r JOIN app.payment p ON p.id = r.payment_id WHERE r.booking_id = $1 ORDER BY r.created_at`,
      [bookingId],
    );
    return rows;
  }

  /**
   * The oldest pending refund of one booking or plan purchase that this run has not tried yet,
   * locked so that no other worker sends it at the same time.
   */
  async lockNextPendingRefund(
    client: TransactionClient,
    owner: RefundOwner,
    skip: readonly string[],
  ): Promise<RefundRow | undefined> {
    const column = owner.kind === 'booking' ? 'booking_id' : 'purchase_id';
    const { rows } = await client.query<RefundRow>(
      `SELECT r.id, r.booking_id AS "bookingId", r.payment_id AS "paymentId", p.gateway_payment_id AS "gatewayPaymentId",
              r.amount_paise AS "amountPaise", r.reason, r.status, r.created_at AS "createdAt"
         FROM app.refund r JOIN app.payment p ON p.id = r.payment_id
        WHERE r.${column} = $1 AND r.status = 'pending' AND NOT (r.id = ANY($2::uuid[]))
        ORDER BY r.created_at, r.id LIMIT 1 FOR UPDATE OF r SKIP LOCKED`,
      [owner.id, skip],
    );
    return rows[0];
  }

  async hasPendingRefunds(client: Queryable, bookingId: string): Promise<boolean> {
    const { rows } = await client.query<{ pending: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM app.refund WHERE booking_id = $1 AND status = 'pending') AS pending`,
      [bookingId],
    );
    return rows[0]?.pending === true;
  }

  async finishRefund(
    client: TransactionClient,
    id: string,
    gatewayRefundId: string,
  ): Promise<void> {
    await client.query(
      `UPDATE app.refund SET status = 'processed', gateway_refund_id = $2, processed_at = now() WHERE id = $1`,
      [id, gatewayRefundId],
    );
  }

  /** Paid payments of the previous day, for reconciliation (LM-06). */
  async paidBetween(from: Date, to: Date): Promise<PaymentRow[]> {
    const { rows } = await this.pool.query<PaymentRow>(
      `SELECT ${PAYMENT_COLUMNS} FROM app.payment p WHERE p.status = 'paid' AND p.paid_at >= $1 AND p.paid_at < $2`,
      [from, to],
    );
    return rows;
  }
}
