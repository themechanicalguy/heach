import { randomUUID } from 'node:crypto';
import type { EncryptedField, FieldEncryptor } from '@heach/crypto';
import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import type pg from 'pg';
import { OBJECT_STORE, type ObjectStore } from '../adapters/object-store.port.js';
import { VIRUS_SCANNER, type VirusScanner } from '../adapters/scanner.port.js';
import { AuditService } from '../audit/audit.service.js';
import { reason } from '../common/error-response.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { type UploadPurpose, uploadProblem } from './upload-rules.js';

export interface UploadInput {
  contentType: string;
  /** The file, base64 encoded; at most 5 MB once decoded. */
  contentBase64: string;
}

export interface PreparedUpload {
  id: string;
  ownerId: string;
  purpose: UploadPurpose;
  contentType: string;
  size: number;
  verdict: 'clean' | 'infected';
}

export interface StoredFile {
  contentType: string;
  contentBase64: string;
}

const ENTITY = 'stored_object';

/**
 * The one way into and out of object storage (EN-07). A file is checked, scanned and encrypted
 * in the documents domain before it is stored; an infected file is kept as a quarantined row with
 * no content. Reads return clean files only and are audited.
 */
@Injectable()
export class UploadsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    @Inject(OBJECT_STORE) private readonly store: ObjectStore,
    @Inject(VIRUS_SCANNER) private readonly scanner: VirusScanner,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
    private readonly audit: AuditService,
  ) {}

  /**
   * Checks, scans, encrypts and stores the bytes, outside any transaction (KMS is a network
   * call). The row is written by `record` in the caller's transaction.
   */
  async prepare(
    ownerId: string,
    purpose: UploadPurpose,
    input: UploadInput,
  ): Promise<PreparedUpload> {
    const bytes = Buffer.from(input.contentBase64, 'base64');
    const problem = uploadProblem(input.contentType, bytes);
    if (problem) throw reason(UnprocessableEntityException, problem);
    const id = randomUUID();
    const verdict = await this.scanner.scan(bytes);
    if (verdict === 'clean') {
      const encrypted = await this.encryptor.encrypt(input.contentBase64, 'documents');
      await this.store.put(objectKey(id), JSON.stringify(encrypted));
    }
    return { id, ownerId, purpose, contentType: input.contentType, size: bytes.length, verdict };
  }

  async record(client: TransactionClient, upload: PreparedUpload): Promise<void> {
    await client.query(
      `INSERT INTO app.stored_object (id, owner_account_id, purpose, content_type, size_bytes, scan_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [upload.id, upload.ownerId, upload.purpose, upload.contentType, upload.size, upload.verdict],
    );
    const action = `${ENTITY}.${upload.verdict}`;
    await this.audit.record({ action, entity: ENTITY, entityId: upload.id }, client);
  }

  /** The file if it is clean; the caller has already checked that the reader may see it. */
  async read(id: string): Promise<StoredFile | undefined> {
    const { rows } = await this.pool.query<{ content_type: string; scan_status: string }>(
      'SELECT content_type, scan_status FROM app.stored_object WHERE id = $1',
      [id],
    );
    const row = rows[0];
    if (row?.scan_status !== 'clean') return undefined;
    const body = await this.store.get(objectKey(id));
    if (!body) return undefined;
    const contentBase64 = await this.encryptor.decrypt(JSON.parse(body) as EncryptedField);
    await this.audit.record({ action: `${ENTITY}.read`, entity: ENTITY, entityId: id });
    return { contentType: row.content_type, contentBase64 };
  }

  async discard(id: string): Promise<void> {
    await this.store.delete(objectKey(id));
  }
}

function objectKey(id: string): string {
  return `objects/${id}`;
}
