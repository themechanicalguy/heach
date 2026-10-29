import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { type TransactionClient, withTransaction } from '../data-stores/transaction.js';
import type { CatalogueItemDto, PinCodeDto } from './catalogue.dto.js';
import type { Service } from './services.js';

export type CatalogueItem = CatalogueItemDto & { id: string };

const ITEM_COLUMNS = `i.code, i.service, i.kind, i.clinical,
  i.prescription_required AS "prescriptionRequired", i.duration_minutes AS "durationMinutes",
  i.sample_type AS "sampleType", i.report_hours AS "reportHours", t.name, t.preparation, i.active`;

/** The service catalogue (AD-04, SL-06, SL-09) and serviceable PIN codes (AD-08). */
@Injectable()
export class CatalogueRepository {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  transaction<T>(work: (client: TransactionClient) => Promise<T>): Promise<T> {
    return withTransaction(this.pool, work);
  }

  async items(
    locale: string,
    filter: { service?: Service; activeOnly: boolean },
  ): Promise<CatalogueItemDto[]> {
    const { rows } = await this.pool.query<CatalogueItemDto>(
      `SELECT ${ITEM_COLUMNS} FROM app.catalogue_item i
         JOIN app.catalogue_item_text t ON t.item_id = i.id AND t.locale = $1
        WHERE ($2::text IS NULL OR i.service = $2) AND (i.active OR NOT $3)
        ORDER BY i.sort_order`,
      [locale, filter.service ?? null, filter.activeOnly],
    );
    return rows;
  }

  async item(code: string, locale = 'en'): Promise<CatalogueItem | undefined> {
    const { rows } = await this.pool.query<CatalogueItem>(
      `SELECT i.id, ${ITEM_COLUMNS} FROM app.catalogue_item i
         JOIN app.catalogue_item_text t ON t.item_id = i.id AND t.locale = $2
        WHERE i.code = $1`,
      [code, locale],
    );
    return rows[0];
  }

  async setActive(client: TransactionClient, code: string, active: boolean): Promise<boolean> {
    const result = await client.query('UPDATE app.catalogue_item SET active = $2 WHERE code = $1', [
      code,
      active,
    ]);
    return result.rowCount === 1;
  }

  async rename(
    client: TransactionClient,
    code: string,
    locale: string,
    name: string,
  ): Promise<void> {
    await client.query(
      `UPDATE app.catalogue_item_text t SET name = $3 FROM app.catalogue_item i
        WHERE i.id = t.item_id AND i.code = $1 AND t.locale = $2`,
      [code, locale, name],
    );
  }

  async pins(): Promise<PinCodeDto[]> {
    const { rows } = await this.pool.query<PinCodeDto>(
      'SELECT pin, district, serviceable FROM app.pin_code ORDER BY pin',
    );
    return rows;
  }

  async setPin(client: TransactionClient, pin: string, serviceable: boolean): Promise<boolean> {
    const result = await client.query('UPDATE app.pin_code SET serviceable = $2 WHERE pin = $1', [
      pin,
      serviceable,
    ]);
    return result.rowCount === 1;
  }
}
