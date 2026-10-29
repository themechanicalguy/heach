import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { TransactionClient } from '../data-stores/transaction.js';
import { TicketsService } from '../tickets/tickets.service.js';

/** Strikes that open a suspension review (amendment A12; the review uses AD-03). */
export const STRIKES_FOR_REVIEW = 3;

/**
 * A provider's late cancellation or no-show is a strike; the third opens a high-priority
 * review ticket for support, who decide on suspension with the existing status controls.
 */
@Injectable()
export class StrikesService {
  constructor(private readonly tickets: TicketsService) {}

  async record(
    client: TransactionClient,
    strike: { providerId: string; bookingId: string; reason: 'late_cancellation' | 'no_show' },
  ): Promise<number> {
    await client.query(
      `INSERT INTO app.provider_strike (id, provider_account_id, booking_id, reason) VALUES ($1, $2, $3, $4)
       ON CONFLICT (booking_id) DO NOTHING`,
      [randomUUID(), strike.providerId, strike.bookingId, strike.reason],
    );
    const { rows } = await client.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM app.provider_strike WHERE provider_account_id = $1',
      [strike.providerId],
    );
    const count = rows[0]?.n ?? 0;
    if (count === STRIKES_FOR_REVIEW) {
      await this.tickets.raiseSystem(client, {
        bookingId: strike.bookingId,
        kind: 'strike_review',
        topic: 'no_show',
      });
    }
    return count;
  }
}
