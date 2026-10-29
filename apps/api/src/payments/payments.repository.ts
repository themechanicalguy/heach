import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import type { TransactionClient } from '../data-stores/transaction.js';

type Queryable = Pick<pg.Pool, 'query'>;

export interface PaymentRow {
  id: string;
  bookingId: string;
  purpose: 'booking' | 'balance';
  orderId: string;
  gatewayPaymentId: string | null;
  amountPaise: number;
  status: 'created' | 'paid' | 'failed';
  refundedPaise: number;
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

const PAYMENT_COLUMNS = `p.id, p.booking_id AS "bookingId", p.purpose, p.gateway_order_id AS "orderId",
  p.gateway_payment_id AS "gatewayPaymentId", p.amount_paise AS "amountPaise", p.status,
  coalesce((SELECT sum(r.amount_paise) FROM app.refund r WHERE r.payment_id = p.id AND r.status <> 'failed'), 0)::int AS "refundedPaise"`;

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

  async lockPendingRefunds(client: TransactionClient, bookingId: string): Promise<RefundRow[]> {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM app.refund WHERE booking_id = $1 AND status = 'pending' FOR UPDATE SKIP LOCKED`,
      [bookingId],
    );
    const ids = new Set(rows.map((row) => row.id));
    return (await this.refunds(bookingId, client)).filter((refund) => ids.has(refund.id));
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
