import { randomUUID } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type pg from 'pg';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../adapters/payments.port.js';
import { AuditService } from '../audit/audit.service.js';
import { appLogger } from '../common/app-logger.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { type TransactionClient, withTransaction } from '../data-stores/transaction.js';
import { JobRunner } from '../jobs/runner/job-runner.js';
import { Settings } from '../settings/settings.service.js';

export const PAYOUT_JOB = 'payout_run';
/** Retries a payout run's transfers until the gateway has accepted each one (PY-05). */
export const PAYOUT_TRANSFER_JOB = 'payout_transfer';

export interface LedgerLine {
  bookingId: string | null;
  kind: string;
  amountPaise: number;
  availableAt: Date;
  paidOut: boolean;
  createdAt: Date;
}

/** The next Monday 06:00 IST after `now`: payouts settle weekly (PY-05). */
export function nextPayoutRun(now: Date): Date {
  const ist = new Date(now.getTime() + 330 * 60_000);
  const daysToMonday = (8 - ist.getUTCDay()) % 7 || 7;
  const monday = Date.UTC(
    ist.getUTCFullYear(),
    ist.getUTCMonth(),
    ist.getUTCDate() + daysToMonday,
    6,
    0,
  );
  return new Date(monday - 330 * 60_000);
}

/**
 * The provider earnings ledger (PY-04) and the weekly payout run (PY-05). An earning becomes
 * available after the complaint hold; a refund after completion is a reversal that the next
 * payout deducts (edge case 11). The run transfers each provider's positive balance once.
 */
@Injectable()
export class LedgerService implements OnModuleInit {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    private readonly settings: Settings,
    private readonly jobs: JobRunner,
    private readonly audit: AuditService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  onModuleInit(): void {
    this.jobs.register(PAYOUT_TRANSFER_JOB, async (payload) => {
      await this.sendTransfers(payload.runId ?? '');
    });
    this.jobs.register(PAYOUT_JOB, async (_payload, now) => {
      await this.runPayouts(now);
      await this.scheduleNext(now);
    });
  }

  async scheduleNext(now: Date): Promise<void> {
    const at = nextPayoutRun(now);
    await this.jobs.enqueue(this.pool, {
      kind: PAYOUT_JOB,
      runAt: at,
      dedupeKey: `payout:${at.toISOString()}`,
    });
  }

  async earn(
    client: TransactionClient,
    entry: {
      providerId: string;
      bookingId: string;
      amountPaise: number;
      kind: 'earning' | 'no_show_fee' | 'commission_rebate';
      at: Date;
      /** `visit`, or `shift:N` when each shift is paid on its own (PK-07). */
      sessionKey?: string;
    },
  ): Promise<boolean> {
    const holdHours = await this.settings.get('payout_hold_hours');
    const inserted = await client.query(
      `INSERT INTO app.ledger_entry (id, provider_account_id, booking_id, kind, amount_paise, available_at, session_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
      [
        randomUUID(),
        entry.providerId,
        entry.bookingId,
        entry.kind,
        entry.amountPaise,
        new Date(entry.at.getTime() + holdHours * 3_600_000),
        entry.sessionKey ?? 'visit',
      ],
    );
    return inserted.rowCount === 1;
  }

  /** Takes back from the provider what a refund after completion returned to the patient. */
  async reverse(client: TransactionClient, bookingId: string, amountPaise: number): Promise<void> {
    const { rows } = await client.query<{ provider_account_id: string }>(
      `SELECT provider_account_id FROM app.ledger_entry WHERE booking_id = $1 AND kind IN ('earning', 'no_show_fee') LIMIT 1`,
      [bookingId],
    );
    const provider = rows[0]?.provider_account_id;
    if (!provider) return;
    await client.query(
      `INSERT INTO app.ledger_entry (id, provider_account_id, booking_id, kind, amount_paise, available_at)
       VALUES ($1, $2, $3, 'reversal', $4, now())`,
      [randomUUID(), provider, bookingId, -amountPaise],
    );
  }

  async lines(providerId: string): Promise<LedgerLine[]> {
    const { rows } = await this.pool.query<LedgerLine>(
      `SELECT booking_id AS "bookingId", kind, amount_paise AS "amountPaise", available_at AS "availableAt",
              (payout_run_id IS NOT NULL) AS "paidOut", created_at AS "createdAt"
         FROM app.ledger_entry WHERE provider_account_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [providerId],
    );
    return rows;
  }

  /** A provider's balance, the part still held, and everything paid out, over the whole ledger. */
  async totals(
    providerId: string,
    now: Date,
  ): Promise<{ balancePaise: number; heldPaise: number; paidOutPaise: number }> {
    const { rows } = await this.pool.query<{
      balancePaise: string;
      heldPaise: string;
      paidOutPaise: string;
    }>(
      `SELECT coalesce(sum(amount_paise) FILTER (WHERE payout_run_id IS NULL), 0) AS "balancePaise",
              coalesce(sum(amount_paise) FILTER (WHERE payout_run_id IS NULL AND available_at > $2), 0) AS "heldPaise",
              coalesce(-sum(amount_paise) FILTER (WHERE kind = 'payout'), 0) AS "paidOutPaise"
         FROM app.ledger_entry WHERE provider_account_id = $1`,
      [providerId, now],
    );
    const row = rows[0];
    return {
      balancePaise: Number(row?.balancePaise ?? 0),
      heldPaise: Number(row?.heldPaise ?? 0),
      paidOutPaise: Number(row?.paidOutPaise ?? 0),
    };
  }

  /** Settles every provider's available, unpaid balance; returns the run's totals. */
  async runPayouts(now: Date): Promise<{ runId: string; providers: number; totalPaise: number }> {
    const runId = randomUUID();
    const due = await withTransaction(this.pool, async (client) => {
      await client.query(
        'INSERT INTO app.payout_run (id, run_at, provider_count, total_paise) VALUES ($1, $2, 0, 0)',
        [runId, now],
      );
      const { rows } = await client.query<{ provider: string; total: number }>(
        `UPDATE app.ledger_entry SET payout_run_id = $1
          WHERE payout_run_id IS NULL AND available_at <= $2 AND kind <> 'payout'
            AND provider_account_id IN (
              SELECT provider_account_id FROM app.ledger_entry
               WHERE payout_run_id IS NULL AND available_at <= $2 AND kind <> 'payout'
               GROUP BY provider_account_id HAVING sum(amount_paise) > 0)
          RETURNING provider_account_id AS provider, amount_paise AS total`,
        [runId, now],
      );
      const byProvider = new Map<string, number>();
      for (const row of rows)
        byProvider.set(row.provider, (byProvider.get(row.provider) ?? 0) + row.total);
      for (const [provider, total] of byProvider) {
        await client.query(
          `INSERT INTO app.ledger_entry (id, provider_account_id, kind, amount_paise, available_at, payout_run_id)
           VALUES ($1, $2, 'payout', $3, $4, $5)`,
          [randomUUID(), provider, -total, now, runId],
        );
        // The transfer to send, committed with the settlement it pays out.
        await client.query(
          `INSERT INTO app.payout_transfer (id, payout_run_id, provider_account_id, amount_paise)
           VALUES ($1, $2, $3, $4)`,
          [randomUUID(), runId, provider, total],
        );
      }
      if (byProvider.size > 0)
        await this.jobs.enqueue(client, { kind: PAYOUT_TRANSFER_JOB, payload: { runId } });
      const totalPaise = [...byProvider.values()].reduce((sum, value) => sum + value, 0);
      await client.query(
        'UPDATE app.payout_run SET provider_count = $2, total_paise = $3 WHERE id = $1',
        [runId, byProvider.size, totalPaise],
      );
      await this.audit.record(
        { action: 'payout_run.settled', entity: 'payout_run', entityId: runId },
        client,
      );
      return byProvider;
    });
    await this.sendTransfers(runId).catch(() => {
      appLogger.warn({ event: 'payout_transfer_deferred' }, 'Payout transfers left for retry');
    });
    const totalPaise = [...due.values()].reduce((sum, value) => sum + value, 0);
    return { runId, providers: due.size, totalPaise };
  }

  /**
   * Sends a run's pending transfers one at a time, each in its own transaction under its row lock,
   * with the transfer's own id as the gateway reference (idempotent). A failure stops the run
   * there: transfers already sent stay sent, and the job retries the rest.
   */
  async sendTransfers(runId: string): Promise<number> {
    let sent = 0;
    for (;;) {
      const done = await withTransaction(this.pool, async (client) => {
        const { rows } = await client.query<{ id: string; provider: string; amount: number }>(
          `SELECT id, provider_account_id AS provider, amount_paise AS amount FROM app.payout_transfer
            WHERE payout_run_id = $1 AND status = 'pending'
            ORDER BY created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED`,
          [runId],
        );
        const transfer = rows[0];
        if (!transfer) return false;
        const { transferId } = await this.gateway.transfer({
          providerId: transfer.provider,
          amountPaise: transfer.amount,
          reference: transfer.id,
        });
        await client.query(
          `UPDATE app.payout_transfer SET status = 'sent', gateway_transfer_id = $2, sent_at = now() WHERE id = $1`,
          [transfer.id, transferId],
        );
        return true;
      });
      if (!done) return sent;
      sent += 1;
    }
  }

  async runs(limit = 20) {
    const { rows } = await this.pool.query<{
      id: string;
      runAt: Date;
      providerCount: number;
      totalPaise: number;
    }>(
      `SELECT id, run_at AS "runAt", provider_count AS "providerCount", total_paise AS "totalPaise"
         FROM app.payout_run ORDER BY run_at DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }
}
