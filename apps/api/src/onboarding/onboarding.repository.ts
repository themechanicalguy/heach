import { randomUUID } from 'node:crypto';
import type { EncryptedField } from '@heach/crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import type { ApplicationStatus } from '../accounts/account.repository.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { type TransactionClient, withTransaction } from '../data-stores/transaction.js';

type Queryable = Pick<pg.Pool, 'query'>;

export interface ProviderGrant {
  role: string;
  status: ApplicationStatus;
  statusReason: string | null;
}

export interface DocumentRow {
  id: string;
  item: string;
  objectId: string;
  scanStatus: 'pending' | 'clean' | 'infected';
  reference: string | null;
  expiresOn: string | null;
  reviewStatus: 'pending' | 'accepted' | 'rejected';
  reviewReason: string | null;
  uploadedAt: Date;
}

export interface DocumentInput {
  item: string;
  objectId: string;
  reference: string | null;
  expiresOn: string | null;
}

export interface PayoutInput {
  method: 'bank' | 'upi';
  holderName: string;
  destination: EncryptedField;
  hint: string;
  ifsc: string | null;
}

export interface StatusChange {
  from: ApplicationStatus;
  to: ApplicationStatus;
  reason: string | null;
  actorId: string | null;
  actorRole: string;
}

const DOCUMENT_COLUMNS = `d.id, d.item, d.object_id AS "objectId", o.scan_status AS "scanStatus",
  d.reference, to_char(d.expires_on, 'YYYY-MM-DD') AS "expiresOn",
  d.review_status AS "reviewStatus", d.review_reason AS "reviewReason", d.uploaded_at AS "uploadedAt"`;

/**
 * Provider applications (PO-01 to PO-06). Every statement names the account it reads or
 * changes, so one provider never reaches another's application (SE-01).
 */
@Injectable()
export class OnboardingRepository {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  transaction<T>(work: (client: TransactionClient) => Promise<T>): Promise<T> {
    return withTransaction(this.pool, work);
  }

  /** The provider grant, locked when given a transaction so two changes cannot interleave. */
  async grant(accountId: string, client?: TransactionClient): Promise<ProviderGrant | undefined> {
    const lock = client ? ' FOR UPDATE' : '';
    const { rows } = await (client ?? this.pool).query<ProviderGrant>(
      `SELECT role, application_status AS status, status_reason AS "statusReason"
         FROM app.role_assignment WHERE account_id = $1 AND side = 'provider'${lock}`,
      [accountId],
    );
    return rows[0];
  }

  async documents(accountId: string, client: Queryable = this.pool): Promise<DocumentRow[]> {
    const { rows } = await client.query<DocumentRow>(
      `SELECT ${DOCUMENT_COLUMNS} FROM app.provider_document d
         JOIN app.stored_object o ON o.id = d.object_id
        WHERE d.account_id = $1 ORDER BY d.item`,
      [accountId],
    );
    return rows;
  }

  async document(accountId: string, id: string): Promise<DocumentRow | undefined> {
    const { rows } = await this.pool.query<DocumentRow>(
      `SELECT ${DOCUMENT_COLUMNS} FROM app.provider_document d
         JOIN app.stored_object o ON o.id = d.object_id
        WHERE d.account_id = $1 AND d.id = $2`,
      [accountId, id],
    );
    return rows[0];
  }

  /** Saves the document for its item, replacing any earlier one; returns the replaced object. */
  async saveDocument(client: TransactionClient, accountId: string, input: DocumentInput) {
    const { rows } = await client.query<{ object_id: string }>(
      'DELETE FROM app.provider_document WHERE account_id = $1 AND item = $2 RETURNING object_id',
      [accountId, input.item],
    );
    const id = randomUUID();
    await client.query(
      `INSERT INTO app.provider_document (id, account_id, item, object_id, reference, expires_on)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, accountId, input.item, input.objectId, input.reference, input.expiresOn],
    );
    return { id, replacedObjectId: rows[0]?.object_id };
  }

  async reviewDocument(
    client: TransactionClient,
    accountId: string,
    documentId: string,
    review: { status: 'accepted' | 'rejected'; reason: string | null },
  ): Promise<boolean> {
    const result = await client.query(
      `UPDATE app.provider_document SET review_status = $3, review_reason = $4
        WHERE account_id = $1 AND id = $2`,
      [accountId, documentId, review.status, review.reason],
    );
    return result.rowCount === 1;
  }

  async identity(accountId: string, client: Queryable = this.pool) {
    const { rows } = await client.query<{
      status: string;
      method: string | null;
      reference: string;
    }>('SELECT status, method, reference FROM app.identity_check WHERE account_id = $1', [
      accountId,
    ]);
    return rows[0];
  }

  async startIdentity(client: TransactionClient, accountId: string, reference: string) {
    await client.query(
      `INSERT INTO app.identity_check (account_id, status, reference) VALUES ($1, 'pending', $2)
       ON CONFLICT (account_id) DO UPDATE SET status = 'pending', method = NULL,
         reference = EXCLUDED.reference, checked_at = NULL`,
      [accountId, reference],
    );
  }

  /** Records the partner's result for the pending check with this reference only. */
  async finishIdentity(
    client: TransactionClient,
    accountId: string,
    reference: string,
    result: { verified: boolean; method: string },
  ): Promise<boolean> {
    const outcome = await client.query(
      `UPDATE app.identity_check SET status = $3, method = $4, checked_at = now()
        WHERE account_id = $1 AND reference = $2 AND status = 'pending'`,
      [accountId, reference, result.verified ? 'verified' : 'failed', result.method],
    );
    return outcome.rowCount === 1;
  }

  async payout(accountId: string, client: Queryable = this.pool) {
    const { rows } = await client.query<{
      method: 'bank' | 'upi';
      holderName: string;
      hint: string;
    }>(
      `SELECT method, holder_name AS "holderName", destination_hint AS hint
         FROM app.payout_account WHERE account_id = $1`,
      [accountId],
    );
    return rows[0];
  }

  async savePayout(client: TransactionClient, accountId: string, input: PayoutInput) {
    await client.query(
      `INSERT INTO app.payout_account (account_id, method, holder_name, destination, destination_hint, ifsc)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (account_id) DO UPDATE SET method = EXCLUDED.method,
         holder_name = EXCLUDED.holder_name, destination = EXCLUDED.destination,
         destination_hint = EXCLUDED.destination_hint, ifsc = EXCLUDED.ifsc, updated_at = now()`,
      [accountId, input.method, input.holderName, input.destination, input.hint, input.ifsc],
    );
  }

  /** Moves the application and records who did it and why (AD-11). */
  async changeStatus(client: TransactionClient, accountId: string, change: StatusChange) {
    await client.query(
      `UPDATE app.role_assignment SET application_status = $2, status_reason = $3
        WHERE account_id = $1 AND side = 'provider'`,
      [accountId, change.to, change.reason],
    );
    await client.query(
      `INSERT INTO app.application_event
         (id, account_id, from_status, to_status, reason, actor_id, actor_role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        accountId,
        change.from,
        change.to,
        change.reason,
        change.actorId,
        change.actorRole,
      ],
    );
  }

  async history(accountId: string) {
    const { rows } = await this.pool.query<{
      fromStatus: string;
      toStatus: string;
      reason: string | null;
      actorRole: string;
      createdAt: Date;
    }>(
      `SELECT from_status AS "fromStatus", to_status AS "toStatus", reason,
              actor_role AS "actorRole", created_at AS "createdAt"
         FROM app.application_event WHERE account_id = $1 ORDER BY created_at`,
      [accountId],
    );
    return rows;
  }

  /** Applications in the review queue, oldest first (AD-02). */
  async queue(statuses: readonly ApplicationStatus[]) {
    const { rows } = await this.pool.query<{
      accountId: string;
      role: string;
      status: ApplicationStatus;
      fullName: string | null;
      submittedAt: Date | null;
    }>(
      `SELECT r.account_id AS "accountId", r.role, r.application_status AS status,
              p.full_name AS "fullName",
              (SELECT max(e.created_at) FROM app.application_event e
                WHERE e.account_id = r.account_id AND e.to_status = 'submitted') AS "submittedAt"
         FROM app.role_assignment r
         LEFT JOIN app.account_profile p ON p.account_id = r.account_id
        WHERE r.side = 'provider' AND r.application_status = ANY($1)
        ORDER BY "submittedAt" NULLS LAST, r.granted_at
        LIMIT 200`,
      [statuses],
    );
    return rows;
  }

  async fullName(accountId: string): Promise<string | null> {
    const { rows } = await this.pool.query<{ full_name: string | null }>(
      'SELECT full_name FROM app.account_profile WHERE account_id = $1',
      [accountId],
    );
    return rows[0]?.full_name ?? null;
  }
}
