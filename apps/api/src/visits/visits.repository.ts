import type { EncryptedField } from '@heach/crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import type { ShiftDto } from './visits.dto.js';

type Queryable = Pick<pg.Pool, 'query'>;
export type ShiftRow = ShiftDto & { id: string; attendantId: string };

const SHIFT_COLUMNS = `id, day_index AS "dayIndex", attendant_account_id AS "attendantId", starts_at AS "startsAt",
  ends_at AS "endsAt", status, checked_in_at AS "checkedInAt", checked_out_at AS "checkedOutAt"`;

/** Visit records and shifts (HS-03 to HS-05). */
@Injectable()
export class VisitsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>) {}

  /** Counts a wrong code; returns the attempts so far (five lock the code). */
  async failedCode(bookingId: string): Promise<number> {
    const { rows } = await this.pool.query<{ code_attempts: number }>(
      `INSERT INTO app.visit (booking_id, code_attempts) VALUES ($1, 1)
       ON CONFLICT (booking_id) DO UPDATE SET code_attempts = app.visit.code_attempts + 1 RETURNING code_attempts`,
      [bookingId],
    );
    return rows[0]?.code_attempts ?? 0;
  }

  async attempts(bookingId: string): Promise<number> {
    const { rows } = await this.pool.query<{ code_attempts: number }>(
      'SELECT code_attempts FROM app.visit WHERE booking_id = $1',
      [bookingId],
    );
    return rows[0]?.code_attempts ?? 0;
  }

  async start(client: TransactionClient, bookingId: string): Promise<void> {
    await client.query(
      `INSERT INTO app.visit (booking_id, started_at) VALUES ($1, now())
       ON CONFLICT (booking_id) DO UPDATE SET started_at = coalesce(app.visit.started_at, now())`,
      [bookingId],
    );
  }

  async complete(
    client: TransactionClient,
    bookingId: string,
    notes: EncryptedField,
  ): Promise<void> {
    await client.query(
      `INSERT INTO app.visit (booking_id, started_at, completed_at, notes) VALUES ($1, now(), now(), $2)
       ON CONFLICT (booking_id) DO UPDATE SET completed_at = now(), notes = EXCLUDED.notes,
         started_at = coalesce(app.visit.started_at, now())`,
      [bookingId, notes],
    );
  }

  async record(
    bookingId: string,
  ): Promise<{ notes: EncryptedField | null; completedAt: Date | null } | undefined> {
    const { rows } = await this.pool.query<{
      notes: EncryptedField | null;
      completedAt: Date | null;
    }>('SELECT notes, completed_at AS "completedAt" FROM app.visit WHERE booking_id = $1', [
      bookingId,
    ]);
    return rows[0];
  }

  async shifts(bookingId: string, client: Queryable = this.pool): Promise<ShiftRow[]> {
    const { rows } = await client.query<ShiftRow>(
      `SELECT ${SHIFT_COLUMNS} FROM app.shift WHERE booking_id = $1 ORDER BY day_index`,
      [bookingId],
    );
    return rows;
  }

  async lockShift(
    client: TransactionClient,
    bookingId: string,
    day: number,
  ): Promise<ShiftRow | undefined> {
    const { rows } = await client.query<ShiftRow>(
      `SELECT ${SHIFT_COLUMNS} FROM app.shift WHERE booking_id = $1 AND day_index = $2 FOR UPDATE`,
      [bookingId, day],
    );
    return rows[0];
  }

  async setShift(
    client: TransactionClient,
    id: string,
    status: 'checked_in' | 'checked_out',
  ): Promise<void> {
    const column = status === 'checked_in' ? 'checked_in_at' : 'checked_out_at';
    await client.query(`UPDATE app.shift SET status = $2, ${column} = now() WHERE id = $1`, [
      id,
      status,
    ]);
  }
}
