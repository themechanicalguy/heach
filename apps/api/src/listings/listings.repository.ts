import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { type TransactionClient, withTransaction } from '../data-stores/transaction.js';
import type { ListingDto, ListingInputDto } from './listings.dto.js';

const LISTING_COLUMNS = `l.id, l.fee_paise AS "feePaise", l.duration_minutes AS "durationMinutes",
  l.active, l.care_settings AS "careSettings", l.home_collection AS "homeCollection"`;

/** A provider's listings and service area (SL-02 to SL-07). Every query names the provider. */
@Injectable()
export class ListingsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  transaction<T>(work: (client: TransactionClient) => Promise<T>): Promise<T> {
    return withTransaction(this.pool, work);
  }

  async byItemCode(providerId: string): Promise<Map<string, ListingDto>> {
    const { rows } = await this.pool.query<ListingDto & { code: string }>(
      `SELECT i.code, ${LISTING_COLUMNS} FROM app.listing l JOIN app.catalogue_item i ON i.id = l.item_id
        WHERE l.provider_account_id = $1`,
      [providerId],
    );
    return new Map(rows.map(({ code, ...listing }) => [code, listing]));
  }

  async save(
    client: TransactionClient,
    providerId: string,
    itemId: string,
    input: ListingInputDto,
  ) {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO app.listing
         (id, provider_account_id, item_id, fee_paise, duration_minutes, active, care_settings, home_collection)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (provider_account_id, item_id) DO UPDATE SET fee_paise = EXCLUDED.fee_paise,
         duration_minutes = EXCLUDED.duration_minutes, active = EXCLUDED.active,
         care_settings = EXCLUDED.care_settings, home_collection = EXCLUDED.home_collection,
         updated_at = now()
       RETURNING id`,
      [
        randomUUID(),
        providerId,
        itemId,
        input.feePaise,
        input.durationMinutes,
        input.active,
        input.careSettings,
        input.homeCollection,
      ],
    );
    return rows[0]?.id ?? '';
  }

  async pins(providerId: string): Promise<string[]> {
    const { rows } = await this.pool.query<{ pin: string }>(
      'SELECT pin FROM app.service_area WHERE account_id = $1 ORDER BY pin',
      [providerId],
    );
    return rows.map((row) => row.pin);
  }

  async surcharge(providerId: string): Promise<number> {
    const { rows } = await this.pool.query<{ travel_surcharge_paise: number }>(
      'SELECT travel_surcharge_paise FROM app.provider_schedule WHERE account_id = $1',
      [providerId],
    );
    return rows[0]?.travel_surcharge_paise ?? 0;
  }

  /** Replaces the area; returns false when a PIN is not serviceable. */
  async replaceArea(
    client: TransactionClient,
    providerId: string,
    pins: readonly string[],
    surcharge: number,
  ) {
    const { rows } = await client.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM app.pin_code WHERE pin = ANY($1) AND serviceable',
      [pins],
    );
    if ((rows[0]?.n ?? 0) !== new Set(pins).size) return false;
    await client.query('DELETE FROM app.service_area WHERE account_id = $1', [providerId]);
    await client.query(
      'INSERT INTO app.service_area (account_id, pin) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING',
      [providerId, pins],
    );
    await client.query(
      `INSERT INTO app.provider_schedule (account_id, travel_surcharge_paise) VALUES ($1, $2)
       ON CONFLICT (account_id) DO UPDATE SET travel_surcharge_paise = EXCLUDED.travel_surcharge_paise,
         updated_at = now()`,
      [providerId, surcharge],
    );
    return true;
  }
}
