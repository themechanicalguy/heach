import { randomUUID } from 'node:crypto';
import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import type pg from 'pg';
import { appLogger } from '../../common/app-logger.js';
import { runWithContext } from '../../common/request-context.js';
import { EnvVars } from '../../config/env.schema.js';
import { PG_POOL } from '../../data-stores/data-stores.tokens.js';
import type { TransactionClient } from '../../data-stores/transaction.js';

export type JobPayload = Readonly<Record<string, string>>;
export type JobHandler = (payload: JobPayload, now: Date) => Promise<void>;

export interface JobRequest {
  kind: string;
  payload?: JobPayload;
  runAt?: Date;
  /** One job per key: scheduling the same timer twice keeps the first (idempotent). */
  dedupeKey?: string;
}

const MAX_ATTEMPTS = 5;
const POLL_MS = 5_000;

/**
 * The job runner (decision D-QUEUE): a PostgreSQL table claimed with FOR UPDATE SKIP LOCKED, so
 * jobs commit with the change that schedules them and several workers never take the same one.
 * A failed job retries with backoff and becomes dead after five attempts (LM-07 backlog alert).
 */
@Injectable()
export class JobRunner implements OnModuleInit, OnApplicationShutdown {
  private readonly handlers = new Map<string, JobHandler>();
  private timer: NodeJS.Timeout | undefined;

  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    private readonly env: EnvVars,
  ) {}

  register(kind: string, handler: JobHandler): void {
    this.handlers.set(kind, handler);
  }

  async enqueue(
    client: TransactionClient | Pick<pg.Pool, 'query'>,
    job: JobRequest,
  ): Promise<void> {
    await client.query(
      `INSERT INTO app.job (id, kind, payload, run_at, dedupe_key) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [randomUUID(), job.kind, job.payload ?? {}, job.runAt ?? new Date(), job.dedupeKey ?? null],
    );
  }

  /** Runs every job due by `now`, one at a time; returns how many ran. */
  async runDue(now = new Date(), limit = 50): Promise<number> {
    let ran = 0;
    while (ran < limit && (await this.runOne(now))) ran += 1;
    return ran;
  }

  onModuleInit(): void {
    if (!this.env.JOBS_IN_PROCESS) return;
    this.timer = setInterval(() => {
      void this.runDue().catch(() => {
        appLogger.warn('Job poll failed');
      });
    }, POLL_MS);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async runOne(now: Date): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{
        id: string;
        kind: string;
        payload: JobPayload;
        attempts: number;
      }>(
        `SELECT id, kind, payload, attempts FROM app.job WHERE status = 'pending' AND run_at <= $1
          ORDER BY run_at LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [now],
      );
      const job = rows[0];
      if (!job) {
        await client.query('COMMIT');
        return false;
      }
      await this.execute(client, job, now);
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async execute(
    client: pg.PoolClient,
    job: { id: string; kind: string; payload: JobPayload; attempts: number },
    now: Date,
  ): Promise<void> {
    const handler = this.handlers.get(job.kind);
    try {
      if (!handler) throw new Error(`No handler for ${job.kind}`);
      await runWithContext({ correlationId: `job:${job.id}`, system: `job:${job.kind}` }, () =>
        handler(job.payload, now),
      );
      await client.query(
        `UPDATE app.job SET status = 'done', finished_at = now(), attempts = attempts + 1 WHERE id = $1`,
        [job.id],
      );
    } catch (error) {
      const attempts = job.attempts + 1;
      const retryAt = new Date(now.getTime() + 60_000 * 2 ** attempts);
      appLogger.warn({ kind: job.kind, attempts }, 'Job failed');
      await client.query(
        `UPDATE app.job SET attempts = $2, last_error = $3, run_at = $4,
                status = CASE WHEN $2 >= $5 THEN 'dead' ELSE 'pending' END WHERE id = $1`,
        [
          job.id,
          attempts,
          (error instanceof Error ? error.message : 'error').slice(0, 200),
          retryAt,
          MAX_ATTEMPTS,
        ],
      );
    }
  }
}
