import { randomUUID } from 'node:crypto';
import type { EncryptedField, FieldEncryptor } from '@heach/crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { AuditService } from '../audit/audit.service.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';

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
 * `health` domain before it reaches PostgreSQL (EN-03.1).
 */
@Injectable()
export class NotesRepository {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
    private readonly audit: AuditService,
  ) {}

  async create(ownerId: string, body: string): Promise<Omit<Note, 'body'>> {
    const id = randomUUID();
    const encrypted = await this.encryptor.encrypt(body, 'health');
    const { rows } = await this.pool.query<{ created_at: Date }>(
      'INSERT INTO app.patient_note (id, owner_id, body) VALUES ($1, $2, $3) RETURNING created_at',
      [id, ownerId, encrypted],
    );
    await this.audit.record({ action: `${ENTITY}.create`, entity: ENTITY, entityId: id });
    return { id, createdAt: rows[0]?.created_at ?? new Date() };
  }

  /** The note if `ownerId` owns it; otherwise undefined, and the denied attempt is audited. */
  async findOwned(ownerId: string, id: string): Promise<Note | undefined> {
    const { rows } = await this.pool.query<NoteRow>(
      'SELECT id, body, created_at FROM app.patient_note WHERE id = $1 AND owner_id = $2',
      [id, ownerId],
    );
    const row = rows[0];
    await this.audit.record({
      action: row ? `${ENTITY}.read` : `${ENTITY}.read.denied`,
      entity: ENTITY,
      entityId: id,
    });
    return row && this.decrypt(row);
  }

  async listOwned(ownerId: string): Promise<Note[]> {
    const { rows } = await this.pool.query<NoteRow>(
      'SELECT id, body, created_at FROM app.patient_note WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 100',
      [ownerId],
    );
    await this.audit.record({ action: `${ENTITY}.list`, entity: ENTITY, entityId: null });
    return Promise.all(rows.map((row) => this.decrypt(row)));
  }

  private async decrypt(row: NoteRow): Promise<Note> {
    return { id: row.id, body: await this.encryptor.decrypt(row.body), createdAt: row.created_at };
  }
}
