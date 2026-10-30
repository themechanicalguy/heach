import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { type TransactionClient, withTransaction } from '../data-stores/transaction.js';
import type { Interval, WeeklyRule } from './slots.js';

export interface Block extends Interval {
  id: string;
}

/** Weekly hours, leave and buffers of a provider (AV-01, AV-03). Each query names the owner. */
@Injectable()
export class AvailabilityRepository {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  transaction<T>(work: (client: TransactionClient) => Promise<T>): Promise<T> {
    return withTransaction(this.pool, work);
  }

  async rules(accountId: string): Promise<WeeklyRule[]> {
    const { rows } = await this.pool.query<WeeklyRule>(
      `SELECT weekday, start_minute AS "startMinute", end_minute AS "endMinute"
         FROM app.availability_rule WHERE account_id = $1 ORDER BY weekday, start_minute`,
      [accountId],
    );
    return rows;
  }

  async replaceRules(client: TransactionClient, accountId: string, rules: readonly WeeklyRule[]) {
    await client.query('DELETE FROM app.availability_rule WHERE account_id = $1', [accountId]);
    for (const rule of rules) {
      await client.query(
        `INSERT INTO app.availability_rule (id, account_id, weekday, start_minute, end_minute)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), accountId, rule.weekday, rule.startMinute, rule.endMinute],
      );
    }
  }

  async bufferMinutes(accountId: string): Promise<number> {
    const { rows } = await this.pool.query<{ buffer_minutes: number }>(
      'SELECT buffer_minutes FROM app.provider_schedule WHERE account_id = $1',
      [accountId],
    );
    return rows[0]?.buffer_minutes ?? 15;
  }

  async setBuffer(client: TransactionClient, accountId: string, minutes: number): Promise<void> {
    await client.query(
      `INSERT INTO app.provider_schedule (account_id, buffer_minutes) VALUES ($1, $2)
       ON CONFLICT (account_id) DO UPDATE SET buffer_minutes = EXCLUDED.buffer_minutes, updated_at = now()`,
      [accountId, minutes],
    );
  }

  async blocks(accountId: string, from: Date): Promise<Block[]> {
    const { rows } = await this.pool.query<Block>(
      `SELECT id, starts_at AS start, ends_at AS "end" FROM app.availability_block
        WHERE account_id = $1 AND ends_at > $2 ORDER BY starts_at`,
      [accountId, from],
    );
    return rows;
  }

  async addBlock(accountId: string, interval: Interval): Promise<string> {
    const id = randomUUID();
    await this.pool.query(
      'INSERT INTO app.availability_block (id, account_id, starts_at, ends_at) VALUES ($1, $2, $3, $4)',
      [id, accountId, interval.start, interval.end],
    );
    return id;
  }

  async removeBlock(accountId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM app.availability_block WHERE account_id = $1 AND id = $2',
      [accountId, id],
    );
    return result.rowCount === 1;
  }

  /** Times the provider cannot take new work: leave and live bookings. */
  async busy(accountId: string, from: Date, to: Date): Promise<Interval[]> {
    const { rows } = await this.pool.query<Interval>(
      `SELECT starts_at AS start, ends_at AS "end" FROM app.availability_block
        WHERE account_id = $1 AND ends_at > $2 AND starts_at < $3
       UNION ALL
       SELECT starts_at, ends_at FROM app.booking
        WHERE provider_account_id = $1 AND ends_at > $2 AND starts_at < $3
          AND status IN ('requested', 'confirmed', 'in_progress')`,
      [accountId, from, to],
    );
    return rows;
  }

  /**
   * Rules, buffers and busy times for many providers in three queries, for search results
   * (SD-03): one query per result would take the connection pool under load (Step 10 load test).
   */
  async inputsFor(accountIds: readonly string[], from: Date, to: Date) {
    const ids = [...new Set(accountIds)];
    const [rules, buffers, busy] = await Promise.all([
      this.pool.query<WeeklyRule & { accountId: string }>(
        `SELECT account_id AS "accountId", weekday, start_minute AS "startMinute", end_minute AS "endMinute"
           FROM app.availability_rule WHERE account_id = ANY($1) ORDER BY weekday, start_minute`,
        [ids],
      ),
      this.pool.query<{ accountId: string; bufferMinutes: number }>(
        `SELECT account_id AS "accountId", buffer_minutes AS "bufferMinutes"
           FROM app.provider_schedule WHERE account_id = ANY($1)`,
        [ids],
      ),
      this.pool.query<Interval & { accountId: string }>(
        `SELECT account_id AS "accountId", starts_at AS start, ends_at AS "end" FROM app.availability_block
          WHERE account_id = ANY($1) AND ends_at > $2 AND starts_at < $3
         UNION ALL
         SELECT provider_account_id, starts_at, ends_at FROM app.booking
          WHERE provider_account_id = ANY($1) AND ends_at > $2 AND starts_at < $3
            AND status IN ('requested', 'confirmed', 'in_progress')`,
        [ids, from, to],
      ),
    ]);
    const group = <T extends { accountId: string }>(rows: readonly T[]) => {
      const byAccount = new Map<string, Omit<T, 'accountId'>[]>();
      for (const { accountId, ...rest } of rows)
        byAccount.set(accountId, [...(byAccount.get(accountId) ?? []), rest]);
      return byAccount;
    };
    return {
      rules: group(rules.rows) as Map<string, WeeklyRule[]>,
      busy: group(busy.rows) as Map<string, Interval[]>,
      buffers: new Map(buffers.rows.map((row) => [row.accountId, row.bufferMinutes])),
    };
  }
}
