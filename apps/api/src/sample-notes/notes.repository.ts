import { randomUUID } from 'node:crypto';
import type { EncryptedField, FieldEncryptor } from '@heach/crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { AuditService } from '../audit/audit.service.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { withTransaction } from '../data-stores/transaction.js';

export interface Note {
  id: string;
  body: string;
  createdAt: Date;
}

interface NoteRow {
  id: string;
  body: EncryptedField;
  created_at: Date;
}

const ENTITY = 'sample_note';

/**
 * Every method reads or writes the Restricted `body`, so every method writes an audit entry
 * (SE-05.1); a test calls each method and fails if one does not. The body is encrypted in the
 * `health` domain before it reaches PostgreSQL (EN-03.1). A write and its entry commit together
 * (SE-05.5); a read is audited only once the data can be returned (SE-05.7, SE-05.8).
 */
@Injectable()
export class NotesRepository {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query' | 'connect'>,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
    private readonly audit: AuditService,
  ) {}

  async create(ownerId: string, body: string): Promise<Omit<Note, 'body'>> {
    const id = randomUUID();
    // Encrypt before BEGIN: no KMS call while the audit lock may be held (spec 003 D-4).
    const encrypted = await this.encryptor.encrypt(body, 'health');
    const createdAt = await withTransaction(this.pool, async (client) => {
      const { rows } = await client.query<{ created_at: Date }>(
        'INSERT INTO app.patient_note (id, owner_id, body) VALUES ($1, $2, $3) RETURNING created_at',
        [id, ownerId, encrypted],
      );
      await this.audit.record({ action: `${ENTITY}.create`, entity: ENTITY, entityId: id }, client);
      return rows[0]?.created_at;
    });
    return { id, createdAt: createdAt ?? new Date() };
  }

  /** The note if `ownerId` owns it; otherwise undefined, and the denied attempt is audited. */
  async findOwned(ownerId: string, id: string): Promise<Note | undefined> {
    const { rows } = await this.pool.query<NoteRow>(
      'SELECT id, body, created_at FROM app.patient_note WHERE id = $1 AND owner_id = $2',
      [id, ownerId],
    );
    const row = rows[0];
    if (!row) {
      await this.audit.record({ action: `${ENTITY}.read.denied`, entity: ENTITY, entityId: id });
      return undefined;
    }
    return this.auditedRead(`${ENTITY}.read`, id, () => this.decrypt(row));
  }

  async listOwned(ownerId: string): Promise<Note[]> {
    const { rows } = await this.pool.query<NoteRow>(
      'SELECT id, body, created_at FROM app.patient_note WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 100',
      [ownerId],
    );
    return this.auditedRead(`${ENTITY}.list`, null, () =>
      Promise.all(rows.map((row) => this.decrypt(row))),
    );
  }

  /**
   * Decrypts, then audits, then returns. A failed decryption is audited as `<action>.failed`
   * (best effort) and rethrown; a failed audit returns no data (SE-05.7, SE-05.8).
   */
  private async auditedRead<T>(
    action: string,
    entityId: string | null,
    read: () => Promise<T>,
  ): Promise<T> {
    let result: T;
    try {
      result = await read();
    } catch (error) {
      await this.audit
        .record({ action: `${action}.failed`, entity: ENTITY, entityId })
        .catch(() => undefined);
      throw error;
    }
    await this.audit.record({ action, entity: ENTITY, entityId });
    return result;
  }

  private async decrypt(row: NoteRow): Promise<Note> {
    return { id: row.id, body: await this.encryptor.decrypt(row.body), createdAt: row.created_at };
  }
}
