import { randomUUID } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type pg from 'pg';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../adapters/payments.port.js';
import { AuditService } from '../audit/audit.service.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { type TransactionClient, withTransaction } from '../data-stores/transaction.js';
import { JobRunner } from '../jobs/runner/job-runner.js';
import { Settings } from '../settings/settings.service.js';

export const PAYOUT_JOB = 'payout_run';

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
      kind: 'earning' | 'no_show_fee';
      at: Date;
    },
  ): Promise<void> {
    const holdHours = await this.settings.get('payout_hold_hours');
    await client.query(
      `INSERT INTO app.ledger_entry (id, provider_account_id, booking_id, kind, amount_paise, available_at)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
      [
        randomUUID(),
        entry.providerId,
        entry.bookingId,
        entry.kind,
        entry.amountPaise,
        new Date(entry.at.getTime() + holdHours * 3_600_000),
      ],
    );
  }

  /** Takes back from the provider what a refund after completion returned to the patient. */
  async reverse(client: TransactionClient, bookingId: string, amountPaise: number): Promise<void> {
    const { rows } = await client.query<{ provider_account_id: string }>(
      `SELECT provider_account_id FROM app.ledger_entry WHERE booking_id = $1 AND kind IN ('earning', 'no_show_fee')`,
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
      }
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
    for (const [providerId, amountPaise] of due) {
      await this.gateway.transfer({ providerId, amountPaise, reference: runId });
    }
    const totalPaise = [...due.values()].reduce((sum, value) => sum + value, 0);
    return { runId, providers: due.size, totalPaise };
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
