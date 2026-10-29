import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import type { TransactionClient } from '../data-stores/transaction.js';

type Queryable = Pick<pg.Pool, 'query'>;

export type LabStage =
  'booked' | 'collector_assigned' | 'sample_collected' | 'received' | 'report_ready';

export interface LabOrderRow {
  bookingId: string;
  collection: 'home' | 'walk_in';
  stage: LabStage;
  collectorId: string | null;
  sampleId: string | null;
  collectedAt: Date | null;
  reportHours: number;
  recollections: number;
}

const ORDER_COLUMNS = `booking_id AS "bookingId", collection, stage, collector_account_id AS "collectorId",
  sample_id AS "sampleId", collected_at AS "collectedAt", report_hours AS "reportHours", recollections`;

/** Lab orders, their tests, stage events and report versions (LB-02 to LB-10). */
@Injectable()
export class LabOrdersRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>) {}

  async create(
    client: TransactionClient,
    order: {
      bookingId: string;
      collection: 'home' | 'walk_in';
      reportHours: number;
      items: { itemId: string; listingId: string; feePaise: number }[];
    },
  ): Promise<void> {
    await client.query(
      'INSERT INTO app.lab_order (booking_id, collection, report_hours) VALUES ($1, $2, $3)',
      [order.bookingId, order.collection, order.reportHours],
    );
    for (const item of order.items) {
      await client.query(
        'INSERT INTO app.lab_order_item (booking_id, item_id, listing_id, fee_paise) VALUES ($1, $2, $3, $4)',
        [order.bookingId, item.itemId, item.listingId, item.feePaise],
      );
    }
    await this.event(client, order.bookingId, 'booked', null, 'patient');
  }

  async find(bookingId: string, client: Queryable = this.pool): Promise<LabOrderRow | undefined> {
    const { rows } = await client.query<LabOrderRow>(
      `SELECT ${ORDER_COLUMNS} FROM app.lab_order WHERE booking_id = $1`,
      [bookingId],
    );
    return rows[0];
  }

  async lock(client: TransactionClient, bookingId: string): Promise<LabOrderRow | undefined> {
    await client.query('SELECT 1 FROM app.lab_order WHERE booking_id = $1 FOR UPDATE', [bookingId]);
    return this.find(bookingId, client);
  }

  async setStage(
    client: TransactionClient,
    bookingId: string,
    change: {
      stage: LabStage;
      collectorId?: string | null;
      sampleId?: string | null;
      recollect?: boolean;
    },
    reason: string | null,
    actorRole: string,
  ): Promise<void> {
    await client.query(
      `UPDATE app.lab_order SET stage = $2,
              collector_account_id = CASE WHEN $3::boolean THEN $4 ELSE collector_account_id END,
              sample_id = CASE WHEN $5::boolean THEN $6 ELSE sample_id END,
              collected_at = CASE WHEN $2 = 'sample_collected' THEN now() WHEN $2 = 'collector_assigned' THEN NULL ELSE collected_at END,
              recollections = recollections + CASE WHEN $7::boolean THEN 1 ELSE 0 END
        WHERE booking_id = $1`,
      [
        bookingId,
        change.stage,
        change.collectorId !== undefined,
        change.collectorId ?? null,
        change.sampleId !== undefined,
        change.sampleId ?? null,
        change.recollect ?? false,
      ],
    );
    await this.event(client, bookingId, change.stage, reason, actorRole);
  }

  async items(bookingId: string, locale: string) {
    const { rows } = await this.pool.query<{
      itemCode: string;
      name: string;
      feePaise: number;
      sampleType: string | null;
    }>(
      `SELECT i.code AS "itemCode", t.name, li.fee_paise AS "feePaise", i.sample_type AS "sampleType"
         FROM app.lab_order_item li JOIN app.catalogue_item i ON i.id = li.item_id
         JOIN app.catalogue_item_text t ON t.item_id = i.id AND t.locale = $2
        WHERE li.booking_id = $1 ORDER BY i.sort_order`,
      [bookingId, locale],
    );
    return rows;
  }

  async events(bookingId: string) {
    const { rows } = await this.pool.query<{
      stage: string;
      reason: string | null;
      actorRole: string;
      createdAt: Date;
    }>(
      `SELECT stage, reason, actor_role AS "actorRole", created_at AS "createdAt" FROM app.lab_event
        WHERE booking_id = $1 ORDER BY created_at`,
      [bookingId],
    );
    return rows;
  }

  async addReport(
    client: TransactionClient,
    bookingId: string,
    objectId: string,
    correction: string | null,
  ): Promise<number> {
    const { rows } = await client.query<{ version: number }>(
      `INSERT INTO app.lab_report (id, booking_id, object_id, version, correction_reason)
       SELECT $1, $2, $3, coalesce(max(version), 0) + 1, $4 FROM app.lab_report WHERE booking_id = $2
       RETURNING version`,
      [randomUUID(), bookingId, objectId, correction],
    );
    return rows[0]?.version ?? 1;
  }

  async reports(bookingId: string) {
    const { rows } = await this.pool.query<{
      version: number;
      objectId: string;
      correctionReason: string | null;
      createdAt: Date;
    }>(
      `SELECT version, object_id AS "objectId", correction_reason AS "correctionReason", created_at AS "createdAt"
         FROM app.lab_report WHERE booking_id = $1 ORDER BY version DESC`,
      [bookingId],
    );
    return rows;
  }

  private async event(
    client: Queryable,
    bookingId: string,
    stage: string,
    reason: string | null,
    actorRole: string,
  ) {
    await client.query(
      'INSERT INTO app.lab_event (id, booking_id, stage, reason, actor_role) VALUES ($1, $2, $3, $4, $5)',
      [randomUUID(), bookingId, stage, reason, actorRole],
    );
  }
}
