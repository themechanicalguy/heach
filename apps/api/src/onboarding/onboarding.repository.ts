import { randomUUID } from 'node:crypto';
import type { EncryptedField } from '@heach/crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import type { ApplicationStatus } from '../accounts/account.repository.js';
import { CONSENT_PURPOSES, type ConsentGiven } from '../accounts/consent-versions.js';
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
  source: 'upload' | 'digilocker';
  issuer: string | null;
}

export interface IdentityRow {
  status: 'pending' | 'verified' | 'failed';
  method: 'aadhaar' | 'digilocker' | 'manual' | null;
  reference: string;
  documentKind: string | null;
  documentObjectId: string | null;
  nameMatch: 'match' | 'mismatch' | null;
}

export interface IdentityOutcome {
  verified: boolean;
  method: string;
  detail: EncryptedField;
  verifiedDetails: EncryptedField | null;
  nameMatch: 'match' | 'mismatch' | null;
}

export interface DocumentInput {
  item: string;
  objectId: string;
  reference: string | null;
  expiresOn: string | null;
  /** Set for a copy shared from DigiLocker (KY-02); an upload has none. */
  issuer?: string;
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
  d.review_status AS "reviewStatus", d.review_reason AS "reviewReason", d.uploaded_at AS "uploadedAt",
  d.source, d.issuer`;

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
      `INSERT INTO app.provider_document
         (id, account_id, item, object_id, reference, expires_on, source, issuer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        accountId,
        input.item,
        input.objectId,
        input.reference,
        input.expiresOn,
        input.issuer ? 'digilocker' : 'upload',
        input.issuer ?? null,
      ],
    );
    return { id, replacedObjectId: rows[0]?.object_id };
  }

  /** Checklist items whose document a verifier has accepted. */
  async acceptedItems(client: TransactionClient, accountId: string): Promise<Set<string>> {
    const { rows } = await client.query<{ item: string }>(
      `SELECT item FROM app.provider_document
        WHERE account_id = $1 AND review_status = 'accepted'`,
      [accountId],
    );
    return new Set(rows.map((row) => row.item));
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
    const { rows } = await client.query<IdentityRow>(
      `SELECT status, method, reference, document_kind AS "documentKind",
              document_object_id AS "documentObjectId", name_match AS "nameMatch"
         FROM app.identity_check WHERE account_id = $1`,
      [accountId],
    );
    return rows[0];
  }

  /** Opens a partner check, dropping any earlier result; returns the fallback document it replaced. */
  async startIdentity(client: TransactionClient, accountId: string, reference: string) {
    const replaced = (await this.identity(accountId, client))?.documentObjectId ?? undefined;
    await client.query(
      `INSERT INTO app.identity_check (account_id, status, reference) VALUES ($1, 'pending', $2)
       ON CONFLICT (account_id) DO UPDATE SET status = 'pending', method = NULL,
         reference = EXCLUDED.reference, checked_at = NULL, detail = NULL,
         verified_details = NULL, name_match = NULL,
         document_object_id = NULL, document_kind = NULL`,
      [accountId, reference],
    );
    return replaced;
  }

  /** Records the partner's result for the pending check with this reference only. */
  async finishIdentity(
    client: TransactionClient,
    accountId: string,
    reference: string,
    result: IdentityOutcome,
  ): Promise<boolean> {
    const outcome = await client.query(
      `UPDATE app.identity_check SET status = $3, method = $4, detail = $5,
              verified_details = $6, name_match = $7, checked_at = now()
        WHERE account_id = $1 AND reference = $2 AND status = 'pending' AND method IS NULL`,
      [
        accountId,
        reference,
        result.verified ? 'verified' : 'failed',
        result.method,
        result.detail,
        result.verifiedDetails,
        result.nameMatch,
      ],
    );
    return outcome.rowCount === 1;
  }

  /** The manual fallback (KY-07): the document waits for a verifier; returns the one it replaced. */
  async saveIdentityDocument(
    client: TransactionClient,
    accountId: string,
    input: { reference: string; objectId: string; kind: string },
  ) {
    const replaced = (await this.identity(accountId, client))?.documentObjectId ?? undefined;
    await client.query(
      `INSERT INTO app.identity_check
         (account_id, status, method, reference, document_object_id, document_kind)
       VALUES ($1, 'pending', 'manual', $2, $3, $4)
       ON CONFLICT (account_id) DO UPDATE SET status = 'pending', method = 'manual',
         reference = EXCLUDED.reference, checked_at = NULL, detail = NULL,
         verified_details = NULL, name_match = NULL,
         document_object_id = EXCLUDED.document_object_id,
         document_kind = EXCLUDED.document_kind`,
      [accountId, input.reference, input.objectId, input.kind],
    );
    return replaced;
  }

  /** A verifier's decision on the fallback document; only a document still waiting can be decided. */
  async reviewIdentityDocument(
    client: TransactionClient,
    accountId: string,
    accepted: boolean,
  ): Promise<boolean> {
    const outcome = await client.query(
      `UPDATE app.identity_check SET status = $2, checked_at = now()
        WHERE account_id = $1 AND status = 'pending' AND method = 'manual'`,
      [accountId, accepted ? 'verified' : 'failed'],
    );
    return outcome.rowCount === 1;
  }

  async verifiedDetails(accountId: string): Promise<EncryptedField | null> {
    const { rows } = await this.pool.query<{ details: EncryptedField | null }>(
      `SELECT verified_details AS details FROM app.identity_check
        WHERE account_id = $1 AND status = 'verified'`,
      [accountId],
    );
    return rows[0]?.details ?? null;
  }

  /** The verified name and gender replace what was typed at sign-up (KY-03). */
  async prefillProfile(
    client: TransactionClient,
    accountId: string,
    verified: { fullName: string; gender: string },
  ): Promise<void> {
    await client.query(
      `UPDATE app.account_profile SET full_name = $2, gender = $3, updated_at = now()
        WHERE account_id = $1`,
      [accountId, verified.fullName, verified.gender],
    );
  }

  /** Consent to the identity check, once per text version (PR-01). */
  async recordIdentityConsent(
    client: TransactionClient,
    accountId: string,
    consent: { purpose: string; version: string },
    locale: string,
    assistedSessionId: string | null = null,
  ): Promise<void> {
    await client.query(
      `INSERT INTO app.consent_record (id, account_id, purpose, version, locale, assisted_session_id)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
      [randomUUID(), accountId, consent.purpose, consent.version, locale, assistedSessionId],
    );
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

  /** Applications in the review queue, oldest first (AD-02); flags show assisted onboarding (AD-12). */
  async queue(statuses: readonly ApplicationStatus[], adminId: string) {
    const { rows } = await this.pool.query<{
      accountId: string;
      role: string;
      status: ApplicationStatus;
      fullName: string | null;
      submittedAt: Date | null;
      assisted: boolean;
      assistedByYou: boolean;
    }>(
      `SELECT r.account_id AS "accountId", r.role, r.application_status AS status,
              p.full_name AS "fullName",
              (SELECT max(e.created_at) FROM app.application_event e
                WHERE e.account_id = r.account_id AND e.to_status = 'submitted') AS "submittedAt",
              EXISTS (SELECT 1 FROM app.assisted_session s
                       WHERE s.account_id = r.account_id AND s.consented_at IS NOT NULL) AS assisted,
              EXISTS (SELECT 1 FROM app.assisted_session s
                       WHERE s.account_id = r.account_id AND s.admin_id = $2
                         AND s.consented_at IS NOT NULL) AS "assistedByYou"
         FROM app.role_assignment r
         LEFT JOIN app.account_profile p ON p.account_id = r.account_id
        WHERE r.side = 'provider' AND r.application_status = ANY($1)
        ORDER BY "submittedAt" NULLS LAST, r.granted_at
        LIMIT 200`,
      [statuses, adminId],
    );
    return rows;
  }

  /** Whether an admin set this application up with the provider (AD-12), and how identity consent came. */
  async assistance(accountId: string, adminId: string, client: Queryable = this.pool) {
    const { rows } = await client.query<{
      assisted: boolean;
      byAdmin: boolean;
      identityConsentAssisted: boolean;
    }>(
      `SELECT EXISTS (SELECT 1 FROM app.assisted_session
                       WHERE account_id = $1 AND consented_at IS NOT NULL) AS assisted,
              EXISTS (SELECT 1 FROM app.assisted_session
                       WHERE account_id = $1 AND admin_id = $2
                         AND consented_at IS NOT NULL) AS "byAdmin",
              EXISTS (SELECT 1 FROM app.consent_record
                       WHERE account_id = $1 AND assisted_session_id IS NOT NULL
                         AND withdrawn_at IS NULL) AS "identityConsentAssisted"`,
      [accountId, adminId],
    );
    return rows[0] ?? { assisted: false, byAdmin: false, identityConsentAssisted: false };
  }

  /** The terms and privacy consents the account has given and not withdrawn (PR-01). */
  async currentConsents(accountId: string, client: Queryable = this.pool): Promise<ConsentGiven[]> {
    const { rows } = await client.query<ConsentGiven>(
      `SELECT purpose, version FROM app.consent_record
        WHERE account_id = $1 AND withdrawn_at IS NULL AND purpose = ANY($2)`,
      [accountId, [...CONSENT_PURPOSES]],
    );
    return rows;
  }

  async fullName(accountId: string, client: Queryable = this.pool): Promise<string | null> {
    const { rows } = await client.query<{ full_name: string | null }>(
      'SELECT full_name FROM app.account_profile WHERE account_id = $1',
      [accountId],
    );
    return rows[0]?.full_name ?? null;
  }
}
