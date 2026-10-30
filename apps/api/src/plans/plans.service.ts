import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import type pg from 'pg';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../adapters/payments.port.js';
import { AuditService } from '../audit/audit.service.js';
import { PLAN_UNITS_LOW_JOB } from '../bookings/discounts.service.js';
import { PaymentEventsService } from '../bookings/payment-events.service.js';
import { RenewalsService } from './renewals.service.js';
import { reason } from '../common/error-response.js';
import type { Plain } from '../common/plain.js';
import type { Principal } from '../common/request-context.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { type TransactionClient, withTransaction } from '../data-stores/transaction.js';
import { JobRunner } from '../jobs/runner/job-runner.js';
import { Notifier } from '../notifications/notifier.service.js';
import { PaymentsRepository } from '../payments/payments.repository.js';
import { Settings } from '../settings/settings.service.js';
import type {
  AdminPurchaseDto,
  PlanDto,
  PlanInputDto,
  PurchaseCheckoutDto,
  PurchaseDto,
} from './plans.dto.js';

export const PLAN_REMINDER_JOB = 'plan_reminder';
const DAY_MS = 86_400_000;

const PLAN_COLUMNS = `p.id, p.kind, p.provider_account_id AS "providerId",
  (SELECT coalesce(o.name, pr.full_name) FROM app.account_profile pr LEFT JOIN app.organisation o ON o.owner_account_id = pr.account_id
    WHERE pr.account_id = p.provider_account_id) AS "providerName",
  (SELECT code FROM app.catalogue_item WHERE id = p.item_id) AS "itemCode", p.service, p.units,
  p.discount_percent AS "discountPercent", p.period, p.family_members AS "familyMembers",
  p.validity_days AS "validityDays", p.price_paise AS "pricePaise", p.status, t.name, t.inclusions, t.exclusions`;

/** What cancelling refunds (PK-07): the paid price in proportion to the units not used. */
export function proRataRefund(paidPaise: number, unitsTotal: number, unitsUsed: number): number {
  if (unitsTotal <= 0) return 0;
  return Math.floor((paidPaise * Math.max(unitsTotal - unitsUsed, 0)) / unitsTotal);
}

/**
 * Care packages and subscriptions (J8; PK-01 to PK-08, AD-14). A purchase is paid through the
 * gateway like a booking; once paid it becomes active and opens its entitlements, which
 * checkout draws (PK-04). Cancelling refunds the unused share and closes the entitlements.
 */
@Injectable()
export class PlansService implements OnModuleInit {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    private readonly payments: PaymentsRepository,
    private readonly events: PaymentEventsService,
    private readonly jobs: JobRunner,
    private readonly settings: Settings,
    private readonly notifier: Notifier,
    private readonly audit: AuditService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly renewals: RenewalsService,
  ) {}

  onModuleInit(): void {
    this.events.onPurchasePaid((client, purchaseId, paid) =>
      this.activate(client, purchaseId, paid),
    );
    this.jobs.register(PLAN_UNITS_LOW_JOB, async (payload) => {
      await this.notifier.notify(payload.buyer ?? '', 'plan_units_low');
    });
    this.jobs.register(PLAN_REMINDER_JOB, async (payload) => {
      const { rows } = await this.pool.query<{ buyer: string; ends_at: Date }>(
        `SELECT buyer_account_id AS buyer, ends_at FROM app.plan_purchase WHERE id = $1 AND status = 'active'`,
        [payload.purchaseId ?? ''],
      );
      const row = rows[0];
      if (row)
        await this.notifier.notify(row.buyer, 'plan_expiring', { time: row.ends_at.toISOString() });
    });
  }

  async list(
    filter: { service?: string; status?: string; providerId?: string },
    locale: string,
  ): Promise<Plain<PlanDto>[]> {
    const { rows } = await this.pool.query<Plain<PlanDto>>(
      `SELECT ${PLAN_COLUMNS} FROM app.plan p JOIN app.plan_text t ON t.plan_id = p.id AND t.locale = $1
        WHERE ($2::text IS NULL OR p.status = $2) AND ($3::uuid IS NULL OR p.provider_account_id = $3)
          AND ($4::text IS NULL OR p.service = $4 OR p.item_id IN (SELECT id FROM app.catalogue_item WHERE service = $4))
        ORDER BY p.created_at DESC LIMIT 200`,
      [locale, filter.status ?? null, filter.providerId ?? null, filter.service ?? null],
    );
    return rows;
  }

  async one(id: string, locale: string): Promise<Plain<PlanDto>> {
    const { rows } = await this.pool.query<Plain<PlanDto>>(
      `SELECT ${PLAN_COLUMNS} FROM app.plan p JOIN app.plan_text t ON t.plan_id = p.id AND t.locale = $2 WHERE p.id = $1`,
      [id, locale],
    );
    const plan = rows[0];
    if (!plan) throw new NotFoundException();
    return plan;
  }

  /** Admin plans are active at once; a provider's package waits for approval (PK-01, AD-14). */
  async define(input: PlanInputDto, providerId: string | null): Promise<string> {
    const item = input.itemCode
      ? (
          await this.pool.query<{ id: string }>(
            'SELECT id FROM app.catalogue_item WHERE code = $1 AND active',
            [input.itemCode],
          )
        ).rows[0]
      : undefined;
    if (input.kind === 'package' && !item) throw reason(ConflictException, 'plan_item_required');
    if (input.kind === 'subscription' && (!input.service || !input.period || providerId))
      throw reason(ConflictException, 'plan_invalid');
    const id = randomUUID();
    await withTransaction(this.pool, async (client) => {
      await client.query(
        `INSERT INTO app.plan (id, kind, provider_account_id, item_id, service, units, discount_percent, period, family_members, validity_days, price_paise, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          id,
          input.kind,
          providerId,
          item?.id ?? null,
          input.kind === 'subscription' ? (input.service ?? null) : null,
          input.units,
          input.discountPercent,
          input.kind === 'subscription' ? (input.period ?? null) : null,
          input.familyMembers,
          input.validityDays,
          input.pricePaise,
          providerId ? 'pending_approval' : 'active',
        ],
      );
      for (const locale of ['or', 'en', 'hi'] as const) {
        const text = input.texts[locale];
        await client.query(
          'INSERT INTO app.plan_text (plan_id, locale, name, inclusions, exclusions) VALUES ($1, $2, $3, $4, $5)',
          [id, locale, text.name, text.inclusions, text.exclusions],
        );
      }
      await this.audit.record({ action: 'plan.defined', entity: 'plan', entityId: id }, client);
    });
    return id;
  }

  async setStatus(id: string, status: 'active' | 'retired'): Promise<void> {
    const result = await this.pool.query('UPDATE app.plan SET status = $2 WHERE id = $1', [
      id,
      status,
    ]);
    if (result.rowCount !== 1) throw new NotFoundException();
    await this.audit.record({ action: `plan.${status}`, entity: 'plan', entityId: id });
  }

  /** The latest purchases for admins (AD-14): no buyer, no health detail. */
  async purchases(): Promise<Plain<AdminPurchaseDto>[]> {
    const { rows } = await this.pool.query<Plain<AdminPurchaseDto>>(
      `SELECT pp.id, t.name AS "planName", p.kind, pp.status, pp.renewed_from_id IS NOT NULL AS renewal,
              pp.auto_renew AS "autoRenew", pp.renewal_paused AS "renewalPaused", pp.paid_paise AS "paidPaise",
              pp.refunded_paise AS "refundedPaise", pp.created_at AS "createdAt", pp.ends_at AS "endsAt"
         FROM app.plan_purchase pp JOIN app.plan p ON p.id = pp.plan_id
         JOIN app.plan_text t ON t.plan_id = pp.plan_id AND t.locale = 'en'
        ORDER BY pp.created_at DESC LIMIT 200`,
    );
    return rows;
  }

  async purchase(buyer: Principal, planId: string): Promise<Plain<PurchaseCheckoutDto>> {
    const plan = await this.one(planId, 'en');
    if (plan.status !== 'active') throw new NotFoundException();
    const purchaseId = randomUUID();
    const { orderId } = await this.gateway.createOrder({
      amountPaise: plan.pricePaise,
      receipt: purchaseId,
    });
    await withTransaction(this.pool, async (client) => {
      await client.query(
        'INSERT INTO app.plan_purchase (id, plan_id, buyer_account_id, price_paise) VALUES ($1, $2, $3, $4)',
        [purchaseId, planId, buyer.userId, plan.pricePaise],
      );
      await this.payments.createForPurchase(client, {
        purchaseId,
        orderId,
        amountPaise: plan.pricePaise,
      });
      await this.audit.record(
        { action: 'plan_purchase.created', entity: 'plan_purchase', entityId: purchaseId },
        client,
      );
    });
    return {
      purchaseId,
      orderId,
      amountPaise: plan.pricePaise,
      sandbox: 'sandboxCapture' in this.gateway,
    };
  }

  async mine(buyerId: string, locale: string): Promise<Plain<PurchaseDto>[]> {
    const { rows } = await this.pool.query<
      Omit<Plain<PurchaseDto>, 'entitlements' | 'refundIfCancelledPaise' | 'people'>
    >(
      `SELECT pp.id, pp.plan_id AS "planId", t.name, p.kind, p.family_members AS "familyMembers", pp.status, pp.auto_renew AS "autoRenew",
              pp.renewal_paused AS "renewalPaused", pp.price_paise AS "pricePaise",
              pp.paid_paise AS "paidPaise", pp.refunded_paise AS "refundedPaise", pp.ends_at AS "endsAt"
         FROM app.plan_purchase pp JOIN app.plan p ON p.id = pp.plan_id
         JOIN app.plan_text t ON t.plan_id = pp.plan_id AND t.locale = $2
        WHERE pp.buyer_account_id = $1 AND (pp.renewed_from_id IS NULL OR pp.status IN ('active', 'expired'))
        ORDER BY pp.created_at DESC LIMIT 50`,
      [buyerId, locale],
    );
    return Promise.all(
      rows.map(async (row) => {
        const entitlements = await this.entitlements(row.id);
        const total = entitlements.reduce((sum, entitlement) => sum + entitlement.unitsTotal, 0);
        const used = entitlements.reduce((sum, entitlement) => sum + entitlement.unitsUsed, 0);
        const refundIfCancelledPaise =
          row.status === 'active'
            ? proRataRefund(row.paidPaise - row.refundedPaise, total, used)
            : 0;
        return { ...row, entitlements, refundIfCancelledPaise, people: await this.people(row.id) };
      }),
    );
  }

  /** Cancels a purchase and refunds the unused share to the original method (PK-07, PY-02). */
  async cancel(buyer: Principal, purchaseId: string): Promise<void> {
    const refund = await withTransaction(this.pool, async (client) => {
      const { rows } = await client.query<{
        status: string;
        paid: number;
        refunded: number;
        mandateId: string | null;
      }>(
        `SELECT status, paid_paise AS paid, refunded_paise AS refunded, mandate_id AS "mandateId"
           FROM app.plan_purchase WHERE id = $1 AND buyer_account_id = $2 FOR UPDATE`,
        [purchaseId, buyer.userId],
      );
      const purchase = rows[0];
      if (!purchase) throw new NotFoundException();
      if (purchase.status !== 'active') throw reason(ConflictException, 'plan_not_active');
      const entitlements = await this.entitlements(purchaseId, client);
      const amount = proRataRefund(
        purchase.paid - purchase.refunded,
        entitlements.reduce((sum, row) => sum + row.unitsTotal, 0),
        entitlements.reduce((sum, row) => sum + row.unitsUsed, 0),
      );
      await client.query(
        `UPDATE app.plan_purchase SET status = 'cancelled', auto_renew = false WHERE id = $1`,
        [purchaseId],
      );
      await client.query(
        'UPDATE app.entitlement SET units_total = greatest(units_used, 1), units_used = least(units_used, greatest(units_used, 1)) WHERE purchase_id = $1',
        [purchaseId],
      );
      const [payment] = (await this.payments.forPurchase(purchaseId, client)).filter(
        (row) => row.status === 'paid',
      );
      if (amount > 0 && payment) {
        const refundId = await this.payments.insertPurchaseRefund(client, {
          purchaseId,
          paymentId: payment.id,
          amountPaise: amount,
          reason: 'plan_cancelled',
          actorRole: buyer.role,
        });
        await this.audit.record(
          { action: 'plan_purchase.cancelled', entity: 'plan_purchase', entityId: purchaseId },
          client,
        );
        return {
          refundId,
          amount,
          gatewayPaymentId: payment.gatewayPaymentId,
          mandateId: purchase.mandateId,
        };
      }
      await this.audit.record(
        { action: 'plan_purchase.cancelled', entity: 'plan_purchase', entityId: purchaseId },
        client,
      );
      return { mandateId: purchase.mandateId };
    });
    await this.renewals.revoke(purchaseId, refund.mandateId);
    if ('gatewayPaymentId' in refund && refund.gatewayPaymentId)
      await this.sendRefund(purchaseId, refund.refundId, refund.gatewayPaymentId, refund.amount);
  }

  private async sendRefund(
    purchaseId: string,
    refundId: string,
    paymentId: string,
    amountPaise: number,
  ): Promise<void> {
    const sent = await this.gateway.refund({ paymentId, amountPaise });
    await withTransaction(this.pool, async (client) => {
      await this.payments.finishRefund(client, refundId, sent.refundId);
      await client.query(
        'UPDATE app.plan_purchase SET refunded_paise = refunded_paise + $2 WHERE id = $1',
        [purchaseId, amountPaise],
      );
    });
  }

  /** The paid purchase becomes active and opens its entitlements (PK-04); a reminder before expiry (PK-08). */
  private async activate(
    client: TransactionClient,
    purchaseId: string,
    paidPaise: number,
  ): Promise<void> {
    const { rows } = await client.query<{
      kind: string;
      item_id: string | null;
      service: string | null;
      provider_account_id: string | null;
      units: number;
      discount_percent: number;
      validity_days: number;
    }>(
      `UPDATE app.plan_purchase pp SET status = 'active', paid_paise = paid_paise + $2,
              starts_at = greatest(now(), coalesce((SELECT prev.ends_at FROM app.plan_purchase prev WHERE prev.id = pp.renewed_from_id), now())),
              ends_at = greatest(now(), coalesce((SELECT prev.ends_at FROM app.plan_purchase prev WHERE prev.id = pp.renewed_from_id), now()))
                        + make_interval(days => p.validity_days)
         FROM app.plan p WHERE p.id = pp.plan_id AND pp.id = $1 AND pp.status = 'pending_payment'
       RETURNING p.kind, p.item_id, p.service, p.provider_account_id, p.units, p.discount_percent, p.validity_days`,
      [purchaseId, paidPaise],
    );
    const plan = rows[0];
    if (!plan) return;
    await client.query(
      `INSERT INTO app.entitlement (id, purchase_id, item_id, service, provider_account_id, units_total, discount_percent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        purchaseId,
        plan.item_id,
        plan.service,
        plan.provider_account_id,
        plan.units,
        plan.discount_percent,
      ],
    );
    const reminderDays = await this.settings.get('plan_expiry_reminder_days');
    const runAt = new Date(Date.now() + Math.max(plan.validity_days - reminderDays, 1) * DAY_MS);
    await this.jobs.enqueue(client, {
      kind: PLAN_REMINDER_JOB,
      payload: { purchaseId },
      runAt,
      dedupeKey: `plan-reminder:${purchaseId}`,
    });
    await this.audit.record(
      { action: 'plan_purchase.activated', entity: 'plan_purchase', entityId: purchaseId },
      client,
    );
    await this.renewals.afterActivation(client, purchaseId);
  }

  /** Units used per covered person, the booker being `null` (PK-04). */
  private async people(purchaseId: string) {
    const { rows } = await this.pool.query<{ linkedPatientId: string | null; unitsUsed: number }>(
      `SELECT b.linked_patient_id AS "linkedPatientId", sum(u.units)::int AS "unitsUsed"
         FROM app.entitlement_use u JOIN app.entitlement e ON e.id = u.entitlement_id
         JOIN app.booking b ON b.id = u.booking_id
        WHERE e.purchase_id = $1 AND u.reversed_at IS NULL
        GROUP BY b.linked_patient_id ORDER BY b.linked_patient_id NULLS FIRST`,
      [purchaseId],
    );
    return rows;
  }

  private async entitlements(purchaseId: string, client: Pick<pg.Pool, 'query'> = this.pool) {
    const { rows } = await client.query<{
      id: string;
      itemCode: string | null;
      service: string | null;
      unitsTotal: number;
      unitsUsed: number;
    }>(
      `SELECT e.id, (SELECT code FROM app.catalogue_item WHERE id = e.item_id) AS "itemCode", e.service,
              e.units_total AS "unitsTotal", e.units_used AS "unitsUsed" FROM app.entitlement e WHERE e.purchase_id = $1`,
      [purchaseId],
    );
    return rows;
  }
}
