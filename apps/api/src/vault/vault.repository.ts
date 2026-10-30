import { randomUUID } from 'node:crypto';
import type { EncryptedField } from '@heach/crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';

type Queryable = Pick<pg.Pool, 'query'>;

export interface RecordRow {
  id: string;
  ownerId: string;
  personId: string | null;
  source: string;
  recordType: string;
  recordDate: string;
  details: EncryptedField;
  objectId: string | null;
  bookingId: string | null;
  issuedBy: string | null;
  createdAt: Date;
}

export interface NewRecord {
  ownerId: string;
  personId: string | null;
  source: 'patient' | 'visit' | 'lab' | 'provider';
  recordType: string;
  recordDate: string;
  details: EncryptedField;
  objectId: string | null;
  bookingId: string | null;
  issuedById: string | null;
}

export interface ShareRow {
  id: string;
  ownerId: string;
  bookingId: string;
  providerId: string;
  recordIds: string[];
  includeHistory: boolean;
  expiresAt: Date;
  revokedAt: Date | null;
}

const RECORD_COLUMNS = `r.id, r.owner_account_id AS "ownerId", r.linked_patient_id AS "personId", r.source,
  r.record_type AS "recordType", to_char(r.record_date, 'YYYY-MM-DD') AS "recordDate", r.details,
  r.object_id AS "objectId", r.booking_id AS "bookingId",
  (SELECT coalesce(o.name, p.full_name) FROM app.account_profile p LEFT JOIN app.organisation o ON o.owner_account_id = p.account_id
    WHERE p.account_id = r.issued_by_account_id) AS "issuedBy", r.created_at AS "createdAt"`;
const SHARE_COLUMNS = `id, owner_account_id AS "ownerId", booking_id AS "bookingId", provider_account_id AS "providerId",
  record_ids AS "recordIds", include_history AS "includeHistory", expires_at AS "expiresAt", revoked_at AS "revokedAt"`;

/** Vault records, history, shares and the access log (MV-01 to MV-12). Every query names its owner. */
@Injectable()
export class VaultRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>) {}

  async insert(client: Queryable, record: NewRecord): Promise<string> {
    const id = randomUUID();
    await client.query(
      `INSERT INTO app.vault_record (id, owner_account_id, linked_patient_id, source, record_type, record_date, details,
         object_id, booking_id, issued_by_account_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`,
      [
        id,
        record.ownerId,
        record.personId,
        record.source,
        record.recordType,
        record.recordDate,
        record.details,
        record.objectId,
        record.bookingId,
        record.issuedById,
      ],
    );
    return id;
  }

  async records(ownerId: string): Promise<RecordRow[]> {
    const { rows } = await this.pool.query<RecordRow>(
      `SELECT ${RECORD_COLUMNS} FROM app.vault_record r WHERE r.owner_account_id = $1 ORDER BY r.record_date DESC, r.created_at DESC LIMIT 500`,
      [ownerId],
    );
    return rows;
  }

  async byIds(ids: readonly string[]): Promise<RecordRow[]> {
    const { rows } = await this.pool.query<RecordRow>(
      `SELECT ${RECORD_COLUMNS} FROM app.vault_record r WHERE r.id = ANY($1)`,
      [ids],
    );
    return rows;
  }

  async owned(ownerId: string, id: string): Promise<RecordRow | undefined> {
    const { rows } = await this.pool.query<RecordRow>(
      `SELECT ${RECORD_COLUMNS} FROM app.vault_record r WHERE r.id = $1 AND r.owner_account_id = $2`,
      [id, ownerId],
    );
    return rows[0];
  }

  /** Deletes a record the owner uploaded; issued records cannot be deleted (MV-12). */
  async deleteOwnUpload(ownerId: string, id: string): Promise<string | null | undefined> {
    const { rows } = await this.pool.query<{ object_id: string | null }>(
      `DELETE FROM app.vault_record WHERE id = $1 AND owner_account_id = $2 AND source = 'patient' RETURNING object_id`,
      [id, ownerId],
    );
    return rows[0] ? rows[0].object_id : undefined;
  }

  async usedBytes(ownerId: string): Promise<number> {
    const { rows } = await this.pool.query<{ n: number }>(
      `SELECT coalesce(sum(o.size_bytes), 0)::int AS n FROM app.vault_record r JOIN app.stored_object o ON o.id = r.object_id
        WHERE r.owner_account_id = $1`,
      [ownerId],
    );
    return rows[0]?.n ?? 0;
  }

  async addHistory(entry: {
    ownerId: string;
    personId: string | null;
    kind: string;
    content: EncryptedField;
    addedBy: string;
    role: string;
  }) {
    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO app.history_entry (id, owner_account_id, linked_patient_id, kind, content, added_by_account_id, added_by_role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, entry.ownerId, entry.personId, entry.kind, entry.content, entry.addedBy, entry.role],
    );
    return id;
  }

  async history(ownerId: string) {
    const { rows } = await this.pool.query<{
      id: string;
      personId: string | null;
      kind: string;
      content: EncryptedField;
      addedByRole: string;
      createdAt: Date;
    }>(
      `SELECT id, linked_patient_id AS "personId", kind, content, added_by_role AS "addedByRole", created_at AS "createdAt"
         FROM app.history_entry WHERE owner_account_id = $1 ORDER BY kind, created_at`,
      [ownerId],
    );
    return rows;
  }

  async deleteHistory(ownerId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM app.history_entry WHERE id = $1 AND owner_account_id = $2 AND added_by_account_id = $2',
      [id, ownerId],
    );
    return result.rowCount === 1;
  }

  async createShare(share: Omit<ShareRow, 'id' | 'revokedAt'>): Promise<string> {
    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO app.record_share (id, owner_account_id, booking_id, provider_account_id, record_ids, include_history, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        share.ownerId,
        share.bookingId,
        share.providerId,
        share.recordIds,
        share.includeHistory,
        share.expiresAt,
      ],
    );
    return id;
  }

  async shares(ownerId: string): Promise<ShareRow[]> {
    const { rows } = await this.pool.query<ShareRow>(
      `SELECT ${SHARE_COLUMNS} FROM app.record_share WHERE owner_account_id = $1 ORDER BY created_at DESC`,
      [ownerId],
    );
    return rows;
  }

  /** The live share of this booking with this provider, if any (MV-08). */
  async liveShare(bookingId: string, providerId: string): Promise<ShareRow | undefined> {
    const { rows } = await this.pool.query<ShareRow>(
      `SELECT ${SHARE_COLUMNS} FROM app.record_share WHERE booking_id = $1 AND provider_account_id = $2
          AND revoked_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
      [bookingId, providerId],
    );
    return rows[0];
  }

  async revokeShare(ownerId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE app.record_share SET revoked_at = now() WHERE id = $1 AND owner_account_id = $2 AND revoked_at IS NULL',
      [id, ownerId],
    );
    return result.rowCount === 1;
  }

  async createLink(link: {
    ownerId: string;
    recordIds: string[];
    tokenHash: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<string> {
    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO app.external_share (id, owner_account_id, record_ids, token_hash, code_hash, expires_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, link.ownerId, link.recordIds, link.tokenHash, link.codeHash, link.expiresAt],
    );
    return id;
  }

  async links(ownerId: string) {
    const { rows } = await this.pool.query<{
      id: string;
      records: number;
      expiresAt: Date;
      revokedAt: Date | null;
    }>(
      `SELECT id, cardinality(record_ids) AS records, expires_at AS "expiresAt", revoked_at AS "revokedAt"
         FROM app.external_share WHERE owner_account_id = $1 ORDER BY created_at DESC`,
      [ownerId],
    );
    return rows;
  }

  async linkByToken(tokenHash: string) {
    const { rows } = await this.pool.query<{
      id: string;
      ownerId: string;
      recordIds: string[];
      codeHash: string;
      attempts: number;
      expiresAt: Date;
      revokedAt: Date | null;
      ownerSuspended: boolean;
    }>(
      `SELECT s.id, s.owner_account_id AS "ownerId", s.record_ids AS "recordIds", s.code_hash AS "codeHash", s.attempts,
              s.expires_at AS "expiresAt", s.revoked_at AS "revokedAt", a.status = 'suspended' AS "ownerSuspended"
         FROM app.external_share s JOIN app.account a ON a.id = s.owner_account_id WHERE s.token_hash = $1`,
      [tokenHash],
    );
    return rows[0];
  }

  async failLink(id: string): Promise<void> {
    await this.pool.query('UPDATE app.external_share SET attempts = attempts + 1 WHERE id = $1', [
      id,
    ]);
  }

  async revokeLink(ownerId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE app.external_share SET revoked_at = now() WHERE id = $1 AND owner_account_id = $2 AND revoked_at IS NULL',
      [id, ownerId],
    );
    return result.rowCount === 1;
  }

  async logAccess(access: {
    recordId: string;
    accessorId: string | null;
    role: string;
    shareId?: string;
    linkId?: string;
  }) {
    await this.pool.query(
      `INSERT INTO app.record_access (id, record_id, accessor_account_id, accessor_role, share_id, external_share_id) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        access.recordId,
        access.accessorId,
        access.role,
        access.shareId ?? null,
        access.linkId ?? null,
      ],
    );
  }

  async accessLog(recordId: string) {
    const { rows } = await this.pool.query<{
      accessorRole: string;
      accessorName: string | null;
      via: string;
      createdAt: Date;
    }>(
      `SELECT a.accessor_role AS "accessorRole",
              (SELECT coalesce(o.name, p.full_name) FROM app.account_profile p LEFT JOIN app.organisation o ON o.owner_account_id = p.account_id
                WHERE p.account_id = a.accessor_account_id) AS "accessorName",
              CASE WHEN a.external_share_id IS NOT NULL THEN 'external_link' ELSE 'booking_share' END AS via,
              a.created_at AS "createdAt"
         FROM app.record_access a WHERE a.record_id = $1 ORDER BY a.created_at DESC LIMIT 100`,
      [recordId],
    );
    return rows;
  }

  /** Breach containment (SO-09): every live share and link of one account stops at once. */
  async revokeAllFor(accountId: string): Promise<{ shares: number; links: number }> {
    const shares = await this.pool.query(
      'UPDATE app.record_share SET revoked_at = now() WHERE owner_account_id = $1 AND revoked_at IS NULL',
      [accountId],
    );
    const links = await this.pool.query(
      'UPDATE app.external_share SET revoked_at = now() WHERE owner_account_id = $1 AND revoked_at IS NULL',
      [accountId],
    );
    return { shares: shares.rowCount ?? 0, links: links.rowCount ?? 0 };
  }
}
