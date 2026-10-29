import { randomUUID } from 'node:crypto';
import type { FieldEncryptor } from '@heach/crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import type { BookingRow } from '../bookings/booking.repository.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import type { TransactionClient } from '../data-stores/transaction.js';

export interface RecordDetails {
  title: string;
  facility?: string | null;
  tags?: string[];
  notes?: string | null;
  visitNotes?: { procedure: string; observations: string; advice: string } | null;
}

export type PreparedFiling = Awaited<ReturnType<FieldEncryptor['encrypt']>>;

const todayInIndia = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

/**
 * Files records created on the application into the patient's vault (MV-02, LB-09): visit
 * notes and lab reports, attributed to the provider who issued them (MV-04). The details are
 * encrypted before the transaction; the filing commits with the change that created the record.
 */
@Injectable()
export class VaultFiling {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
  ) {}

  /** Encrypts the record's details, named after the booking's service and its provider. */
  async prepare(
    booking: Pick<BookingRow, 'itemId' | 'providerId'>,
    extra: Omit<RecordDetails, 'title' | 'facility'>,
  ): Promise<PreparedFiling> {
    const { rows } = await this.pool.query<{ title: string | null; facility: string | null }>(
      `SELECT (SELECT name FROM app.catalogue_item_text WHERE item_id = $1 AND locale = 'en') AS title,
              (SELECT coalesce(o.name, p.full_name) FROM app.account_profile p LEFT JOIN app.organisation o ON o.owner_account_id = p.account_id
                WHERE p.account_id = $2) AS facility`,
      [booking.itemId, booking.providerId],
    );
    const details: RecordDetails = {
      title: rows[0]?.title ?? 'Record',
      facility: rows[0]?.facility ?? null,
      ...extra,
    };
    return this.encryptor.encrypt(JSON.stringify(details), 'health');
  }

  /** Files the record, or replaces it with a corrected version for the same booking (LB-10). */
  async file(
    client: TransactionClient,
    booking: Pick<BookingRow, 'id' | 'bookerId' | 'linkedPatientId' | 'providerId'>,
    filing: {
      source: 'visit' | 'lab';
      recordType: 'visit_note' | 'lab_report';
      details: PreparedFiling;
      objectId: string | null;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO app.vault_record (id, owner_account_id, linked_patient_id, source, record_type, record_date, details,
         object_id, booking_id, issued_by_account_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (booking_id, source) WHERE source IN ('visit', 'lab')
       DO UPDATE SET details = EXCLUDED.details, object_id = EXCLUDED.object_id`,
      [
        randomUUID(),
        booking.bookerId,
        booking.linkedPatientId,
        filing.source,
        filing.recordType,
        todayInIndia(),
        filing.details,
        filing.objectId,
        booking.id,
        booking.providerId,
      ],
    );
  }
}
