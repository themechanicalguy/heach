import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { formatPaise } from '@heach/i18n';
import type pg from 'pg';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../adapters/payments.port.js';
import type { SmsTemplate } from '../adapters/sms.port.js';
import { AuditService } from '../audit/audit.service.js';
import { PaymentEventsService } from '../bookings/payment-events.service.js';
import { appLogger } from '../common/app-logger.js';
import { reason } from '../common/error-response.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { type TransactionClient, withTransaction } from '../data-stores/transaction.js';
import { JobRunner } from '../jobs/runner/job-runner.js';
import { Notifier } from '../notifications/notifier.service.js';
import { PaymentsRepository } from '../payments/payments.repository.js';
import { Settings } from '../settings/settings.service.js';

export const RENEWAL_NOTICE_JOB = 'plan_renewal_notice';
export const RENEWAL_CHARGE_JOB = 'plan_renewal_charge';
export const RENEWAL_OUTCOME_JOB = 'plan_renewal_outcome';
const HOUR_MS = 3_600_000;

interface Renewable {
  id: string;
  buyer: string;
  status: string;
  autoRenew: boolean;
  mandateId: string | null;
  paused: boolean;
  attempts: number;
  endsAt: Date | null;
  planId: string;
  planStatus: string;
  kind: string;
  pricePaise: number;
}

const RENEWABLE = `SELECT pp.id, pp.buyer_account_id AS buyer, pp.status, pp.auto_renew AS "autoRenew",
         pp.mandate_id AS "mandateId", pp.renewal_paused AS paused, pp.renewal_attempts AS attempts,
         pp.ends_at AS "endsAt", p.id AS "planId", p.status AS "planStatus", p.kind, p.price_paise AS "pricePaise"
    FROM app.plan_purchase pp JOIN app.plan p ON p.id = pp.plan_id WHERE pp.id = $1`;

/**
 * Subscription renewal (PK-05, PK-06). Turning auto-renew on sets up a gateway mandate; a
 * pre-debit notice goes out before the period ends, then the mandate is charged. Each renewal is
 * a new purchase linked to the one it renews, activated by the usual paid webhook. A failed
 * debit retries, and after the last try renewal pauses until the patient turns it on again.
 */
@Injectable()
export class RenewalsService implements OnModuleInit {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    private readonly payments: PaymentsRepository,
    private readonly events: PaymentEventsService,
    private readonly jobs: JobRunner,
    private readonly settings: Settings,
    private readonly notifier: Notifier,
    private readonly audit: AuditService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  onModuleInit(): void {
    this.events.onPurchaseFailed((client, purchaseId) => this.failed(client, purchaseId));
    this.jobs.register(RENEWAL_NOTICE_JOB, (payload) => this.notice(payload.purchaseId ?? ''));
    this.jobs.register(RENEWAL_CHARGE_JOB, (payload) =>
      this.charge(payload.purchaseId ?? '', Number(payload.attempt ?? '1')),
    );
    this.jobs.register(RENEWAL_OUTCOME_JOB, async (payload) => {
      await this.notifier.notify(payload.buyer ?? '', payload.template as SmsTemplate);
    });
  }

  /** Turns renewal on: a mandate capped at the plan's price, then the notice and the charge. */
  async enable(buyerId: string, purchaseId: string): Promise<void> {
    const purchase = await this.load(this.pool, purchaseId);
    if (purchase?.buyer !== buyerId || purchase.status !== 'active') throw new NotFoundException();
    if (purchase.kind !== 'subscription') throw reason(ConflictException, 'plan_not_renewable');
    const mandateId =
      purchase.mandateId ??
      (
        await this.gateway.createMandate({
          reference: purchaseId,
          maxAmountPaise: purchase.pricePaise,
        })
      ).mandateId;
    await withTransaction(this.pool, async (client) => {
      await client.query(
        `UPDATE app.plan_purchase SET auto_renew = true, mandate_id = $2, renewal_paused = false, renewal_attempts = 0
          WHERE id = $1`,
        [purchaseId, mandateId],
      );
      await this.schedule(client, purchaseId, purchase.endsAt ?? new Date());
      await this.audit.record(
        { action: 'plan_purchase.auto_renew_on', entity: 'plan_purchase', entityId: purchaseId },
        client,
      );
    });
  }

  /** Turns renewal off at any time and revokes the mandate; the plan runs to its end (PK-06). */
  async disable(buyerId: string, purchaseId: string): Promise<void> {
    const { rows } = await this.pool.query<{ mandateId: string | null }>(
      `UPDATE app.plan_purchase SET auto_renew = false WHERE id = $1 AND buyer_account_id = $2
       RETURNING mandate_id AS "mandateId"`,
      [purchaseId, buyerId],
    );
    if (!rows[0]) throw new NotFoundException();
    await this.revoke(purchaseId, rows[0].mandateId);
  }

  /** Revokes a purchase's mandate at the gateway, then forgets it. */
  async revoke(purchaseId: string, mandateId: string | null): Promise<void> {
    if (!mandateId) return;
    await this.gateway.cancelMandate(mandateId);
    await this.pool.query('UPDATE app.plan_purchase SET mandate_id = NULL WHERE id = $1', [
      purchaseId,
    ]);
  }

  /**
   * A renewal was paid and activated: it carries the mandate on, its period follows the previous
   * one, and the next renewal is scheduled. Called inside the paid webhook's transaction.
   */
  async afterActivation(client: TransactionClient, purchaseId: string): Promise<void> {
    const { rows } = await client.query<{ previous: string; buyer: string; endsAt: Date }>(
      `UPDATE app.plan_purchase pp SET auto_renew = prev.auto_renew, mandate_id = prev.mandate_id
         FROM app.plan_purchase prev WHERE prev.id = pp.renewed_from_id AND pp.id = $1
       RETURNING prev.id AS previous, pp.buyer_account_id AS buyer, pp.ends_at AS "endsAt"`,
      [purchaseId],
    );
    const renewal = rows[0];
    if (!renewal) return;
    await client.query(
      `UPDATE app.plan_purchase SET auto_renew = false, mandate_id = NULL, renewal_attempts = 0,
              status = CASE WHEN ends_at <= now() THEN 'expired' ELSE status END
        WHERE id = $1`,
      [renewal.previous],
    );
    await this.schedule(client, purchaseId, renewal.endsAt);
    await this.outcome(client, renewal.buyer, 'plan_renewed', purchaseId);
  }

  /** The notice always goes out at least the notice period before the debit (pre-debit notice). */
  private async schedule(client: TransactionClient, purchaseId: string, endsAt: Date) {
    const noticeMs = (await this.settings.get('renewal_notice_hours')) * HOUR_MS;
    const chargeAt = new Date(Math.max(endsAt.getTime(), Date.now() + noticeMs));
    await this.jobs.enqueue(client, {
      kind: RENEWAL_NOTICE_JOB,
      payload: { purchaseId },
      runAt: new Date(chargeAt.getTime() - noticeMs),
      dedupeKey: `renewal-notice:${purchaseId}:${chargeAt.toISOString()}`,
    });
    await this.jobs.enqueue(client, {
      kind: RENEWAL_CHARGE_JOB,
      payload: { purchaseId, attempt: '1' },
      runAt: chargeAt,
    });
  }

  /** The pre-debit notice: amount and date of the coming debit (PK-05). */
  async notice(purchaseId: string): Promise<void> {
    const purchase = await this.load(this.pool, purchaseId);
    if (!purchase?.autoRenew || purchase.paused || purchase.status !== 'active') return;
    await this.notifier.notify(purchase.buyer, 'plan_renewal_notice', {
      amount: formatPaise(purchase.pricePaise),
      time: (purchase.endsAt ?? new Date()).toISOString(),
    });
  }

  /**
   * Charges the mandate for one attempt. The attempt number guards against a second job for the
   * same attempt charging twice; the debit itself happens outside any transaction.
   */
  async charge(purchaseId: string, attempt: number): Promise<void> {
    const due = await withTransaction(this.pool, (client) =>
      this.claim(client, purchaseId, attempt),
    );
    if (!due) return;
    let orderId: string;
    try {
      ({ orderId } = await this.gateway.chargeMandate({
        mandateId: due.mandateId,
        amountPaise: due.pricePaise,
        receipt: due.renewalId,
      }));
    } catch {
      appLogger.warn({ attempt }, 'Renewal debit refused');
      await withTransaction(this.pool, (client) => this.failed(client, due.renewalId));
      return;
    }
    await withTransaction(this.pool, async (client) => {
      await this.payments.createForPurchase(client, {
        purchaseId: due.renewalId,
        orderId,
        amountPaise: due.pricePaise,
      });
    });
  }

  /** Locks the purchase and records this attempt; returns what to charge, or nothing. */
  private async claim(client: TransactionClient, purchaseId: string, attempt: number) {
    const purchase = await this.load(client, purchaseId, true);
    if (
      !purchase?.autoRenew ||
      purchase.paused ||
      !purchase.mandateId ||
      !['active', 'expired'].includes(purchase.status) ||
      purchase.attempts !== attempt - 1
    )
      return undefined;
    if (purchase.planStatus !== 'active') {
      await this.pause(client, purchase);
      return undefined;
    }
    const renewalId = await this.renewalRow(client, purchase);
    if (!renewalId) return undefined;
    await client.query('UPDATE app.plan_purchase SET renewal_attempts = $2 WHERE id = $1', [
      purchaseId,
      attempt,
    ]);
    return { renewalId, mandateId: purchase.mandateId, pricePaise: purchase.pricePaise };
  }

  /** The pending renewal purchase for this period, created on the first attempt. */
  private async renewalRow(client: TransactionClient, purchase: Renewable) {
    const { rows } = await client.query<{ id: string; status: string }>(
      'SELECT id, status FROM app.plan_purchase WHERE renewed_from_id = $1',
      [purchase.id],
    );
    const existing = rows[0];
    if (existing) return existing.status === 'pending_payment' ? existing.id : undefined;
    const id = randomUUID();
    await client.query(
      `INSERT INTO app.plan_purchase (id, plan_id, buyer_account_id, price_paise, renewed_from_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, purchase.planId, purchase.buyer, purchase.pricePaise, purchase.id],
    );
    return id;
  }

  /** A renewal debit failed: retry later, or pause after the last attempt. */
  private async failed(client: TransactionClient, renewalId: string): Promise<void> {
    const { rows } = await client.query<{ previous: string | null }>(
      'SELECT renewed_from_id AS previous FROM app.plan_purchase WHERE id = $1',
      [renewalId],
    );
    const previousId = rows[0]?.previous;
    if (!previousId) return;
    const purchase = await this.load(client, previousId, true);
    if (!purchase?.autoRenew) return;
    if (purchase.attempts >= (await this.settings.get('renewal_max_attempts'))) {
      await this.pause(client, purchase);
      return;
    }
    const retryHours = await this.settings.get('renewal_retry_hours');
    await this.jobs.enqueue(client, {
      kind: RENEWAL_CHARGE_JOB,
      payload: { purchaseId: purchase.id, attempt: String(purchase.attempts + 1) },
      runAt: new Date(Date.now() + retryHours * HOUR_MS),
    });
    await this.outcome(client, purchase.buyer, 'plan_renewal_failed', purchase.id);
  }

  private async pause(client: TransactionClient, purchase: Renewable): Promise<void> {
    await client.query(
      'UPDATE app.plan_purchase SET auto_renew = false, renewal_paused = true WHERE id = $1',
      [purchase.id],
    );
    await client.query(
      `UPDATE app.plan_purchase SET status = 'cancelled' WHERE renewed_from_id = $1 AND status = 'pending_payment'`,
      [purchase.id],
    );
    await this.audit.record(
      { action: 'plan_purchase.renewal_paused', entity: 'plan_purchase', entityId: purchase.id },
      client,
    );
    await this.outcome(client, purchase.buyer, 'plan_renewal_paused', purchase.id);
  }

  /** Tells the patient after the transaction commits, through a job (no network inside it). */
  private async outcome(
    client: TransactionClient,
    buyer: string,
    template: SmsTemplate,
    purchaseId: string,
  ): Promise<void> {
    await this.jobs.enqueue(client, {
      kind: RENEWAL_OUTCOME_JOB,
      payload: { buyer, template, purchaseId },
    });
  }

  private async load(
    client: Pick<pg.Pool, 'query'>,
    purchaseId: string,
    lock = false,
  ): Promise<Renewable | undefined> {
    const { rows } = await client.query<Renewable>(
      lock ? `${RENEWABLE} FOR UPDATE OF pp` : RENEWABLE,
      [purchaseId],
    );
    return rows[0];
  }
}
