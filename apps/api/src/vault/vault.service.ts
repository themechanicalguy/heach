import type { EncryptedField, FieldEncryptor } from '@heach/crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type pg from 'pg';
import { AuditService } from '../audit/audit.service.js';
import { BookingRepository } from '../bookings/booking.repository.js';
import { reason } from '../common/error-response.js';
import type { Plain } from '../common/plain.js';
import type { Principal } from '../common/request-context.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { withTransaction } from '../data-stores/transaction.js';
import { Settings } from '../settings/settings.service.js';
import { type StoredFile, UploadsService } from '../uploads/uploads.service.js';
import { ShareKeys } from './share-keys.js';
import type { RecordDetails } from './vault-filing.js';
import type {
  HistoryEntryDto,
  HistoryInputDto,
  LinkCreatedDto,
  LinkInputDto,
  ProviderRecordInputDto,
  RecordDto,
  RecordInputDto,
  ShareInputDto,
  SharedRecordsDto,
  UsageDto,
  VaultQueryDto,
} from './vault.dto.js';
import { type RecordRow, VaultRepository } from './vault.repository.js';

const SHARE_AFTER_END_MS = 24 * 3_600_000;
const MAX_LINK_ATTEMPTS = 5;
const SHAREABLE = new Set(['requested', 'confirmed', 'in_progress']);

/**
 * The patient's vault (J9; MV-01 to MV-15). Records and history are Restricted, encrypted in the
 * health domain; reads by anyone but the owner go through a share and are logged (MV-10). The
 * owner is the account holder, who also manages their linked patients' records (MV-01).
 */
@Injectable()
export class VaultService {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    private readonly vault: VaultRepository,
    private readonly bookings: BookingRepository,
    private readonly uploads: UploadsService,
    private readonly keys: ShareKeys,
    private readonly settings: Settings,
    private readonly audit: AuditService,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
  ) {}

  async list(ownerId: string, query: VaultQueryDto): Promise<Plain<RecordDto>[]> {
    const rows = (await this.vault.records(ownerId)).filter((row) =>
      this.matchesFilters(row, query),
    );
    const records = await Promise.all(rows.map((row) => this.view(row)));
    await this.audit.record({ action: 'vault.listed', entity: 'vault', entityId: ownerId });
    const text = query.q?.toLowerCase();
    return text
      ? records.filter((record) =>
          [record.title, record.facility ?? '', record.issuedBy ?? '', ...record.tags].some(
            (value) => value.toLowerCase().includes(text),
          ),
        )
      : records;
  }

  async upload(ownerId: string, input: RecordInputDto): Promise<Plain<RecordDto>> {
    await this.assertPerson(ownerId, input.personId);
    const prepared = input.file
      ? await this.uploads.prepare(ownerId, 'vault_upload', input.file)
      : undefined;
    if (prepared?.verdict === 'infected') throw reason(BadRequestException, 'upload_infected');
    if (prepared) await this.assertQuota(ownerId, prepared.size);
    const details = await this.encrypt({
      title: input.title,
      facility: input.facility ?? null,
      tags: input.tags ?? [],
      notes: input.notes ?? null,
    });
    const id = await withTransaction(this.pool, async (client) => {
      if (prepared) await this.uploads.record(client, prepared);
      const created = await this.vault.insert(client, {
        ownerId,
        personId: input.personId ?? null,
        source: 'patient',
        recordType: input.recordType,
        recordDate: input.recordDate,
        details,
        objectId: prepared?.id ?? null,
        bookingId: null,
        issuedById: null,
      });
      await this.audit.record(
        { action: 'vault_record.uploaded', entity: 'vault_record', entityId: created },
        client,
      );
      return created;
    });
    return this.view(await this.mustOwn(ownerId, id));
  }

  async file(ownerId: string, id: string): Promise<StoredFile> {
    const row = await this.mustOwn(ownerId, id);
    const file = row.objectId ? await this.uploads.read(row.objectId) : undefined;
    if (!file) throw new NotFoundException();
    return file;
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const objectId = await this.vault.deleteOwnUpload(ownerId, id);
    if (objectId === undefined) throw reason(ForbiddenException, 'record_not_deletable');
    if (objectId) await this.uploads.discard(objectId);
    await this.audit.record({
      action: 'vault_record.deleted',
      entity: 'vault_record',
      entityId: id,
    });
  }

  async usage(ownerId: string): Promise<UsageDto> {
    const quotaBytes = (await this.settings.get('vault_quota_mb')) * 1024 * 1024;
    const usedBytes = await this.vault.usedBytes(ownerId);
    return { usedBytes, quotaBytes, nearlyFull: usedBytes >= quotaBytes * 0.8 };
  }

  async history(ownerId: string): Promise<Plain<HistoryEntryDto>[]> {
    const rows = await this.vault.history(ownerId);
    return Promise.all(
      rows.map(async ({ content, ...row }) => ({
        ...row,
        text: await this.encryptor.decrypt(content),
      })),
    );
  }

  async addHistory(principal: Principal, input: HistoryInputDto): Promise<void> {
    await this.assertPerson(principal.userId, input.personId);
    const content = await this.encryptor.encrypt(input.text, 'health');
    const id = await this.vault.addHistory({
      ownerId: principal.userId,
      personId: input.personId ?? null,
      kind: input.kind,
      content,
      addedBy: principal.userId,
      role: principal.role,
    });
    await this.audit.record({
      action: 'history_entry.added',
      entity: 'history_entry',
      entityId: id,
    });
  }

  async removeHistory(ownerId: string, id: string): Promise<void> {
    if (!(await this.vault.deleteHistory(ownerId, id))) throw new NotFoundException();
  }

  /** Shares records with the provider of one of the owner's bookings (MV-07). */
  async share(ownerId: string, input: ShareInputDto): Promise<string> {
    const booking = await this.bookings.find(input.bookingId);
    if (booking?.bookerId !== ownerId || !booking.providerId) throw new NotFoundException();
    if (!SHAREABLE.has(booking.status)) throw reason(ConflictException, 'booking_not_shareable');
    const owned = await this.vault.byIds(input.recordIds);
    if (
      owned.length !== new Set(input.recordIds).size ||
      owned.some((row) => row.ownerId !== ownerId)
    )
      throw new NotFoundException();
    const id = await this.vault.createShare({
      ownerId,
      bookingId: booking.id,
      providerId: booking.providerId,
      recordIds: [...new Set(input.recordIds)],
      includeHistory: input.includeHistory,
      expiresAt: new Date(booking.endsAt.getTime() + SHARE_AFTER_END_MS),
    });
    await this.audit.record({
      action: 'record_share.created',
      entity: 'record_share',
      entityId: id,
    });
    return id;
  }

  async revokeShare(ownerId: string, id: string): Promise<void> {
    if (!(await this.vault.revokeShare(ownerId, id))) throw new NotFoundException();
    await this.audit.record({
      action: 'record_share.revoked',
      entity: 'record_share',
      entityId: id,
    });
  }

  /** The "Shared records" panel (MV-08): only what this booking's share holds, each read logged. */
  async sharedWithProvider(
    provider: Principal,
    bookingId: string,
  ): Promise<Plain<SharedRecordsDto>> {
    const share = await this.vault.liveShare(bookingId, provider.userId);
    if (!share) return { records: [], history: [], files: [] };
    const rows = (await this.vault.byIds(share.recordIds)).filter(
      (row) => row.ownerId === share.ownerId,
    );
    for (const row of rows)
      await this.vault.logAccess({
        recordId: row.id,
        accessorId: provider.userId,
        role: provider.role,
        shareId: share.id,
      });
    const history = share.includeHistory ? await this.history(share.ownerId) : [];
    return { records: await Promise.all(rows.map((row) => this.view(row))), history, files: [] };
  }

  async sharedFile(provider: Principal, bookingId: string, recordId: string): Promise<StoredFile> {
    const share = await this.vault.liveShare(bookingId, provider.userId);
    const [row] = share?.recordIds.includes(recordId) ? await this.vault.byIds([recordId]) : [];
    const file =
      row?.objectId && row.ownerId === share?.ownerId
        ? await this.uploads.read(row.objectId)
        : undefined;
    if (!share || !file) throw new NotFoundException();
    await this.vault.logAccess({
      recordId,
      accessorId: provider.userId,
      role: provider.role,
      shareId: share.id,
    });
    return file;
  }

  /** A provider adds a record within their booking, attributed to them (MV-14). */
  async addFromProvider(
    provider: Principal,
    bookingId: string,
    input: ProviderRecordInputDto,
  ): Promise<void> {
    const booking = await this.bookings.find(bookingId);
    if (
      booking?.providerId !== provider.userId ||
      !['confirmed', 'in_progress', 'completed'].includes(booking.status)
    )
      throw new NotFoundException();
    const prepared = input.file
      ? await this.uploads.prepare(provider.userId, 'visit_record', input.file)
      : undefined;
    if (prepared?.verdict === 'infected') throw reason(BadRequestException, 'upload_infected');
    const details = await this.encrypt({
      title: input.title,
      notes: input.notes ?? null,
      tags: [],
    });
    await withTransaction(this.pool, async (client) => {
      if (prepared) await this.uploads.record(client, prepared);
      const id = await this.vault.insert(client, {
        ownerId: booking.bookerId,
        personId: booking.linkedPatientId,
        source: 'provider',
        recordType: input.recordType,
        recordDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
          new Date(),
        ),
        details,
        objectId: prepared?.id ?? null,
        bookingId,
        issuedById: provider.userId,
      });
      await this.audit.record(
        { action: 'vault_record.added_by_provider', entity: 'vault_record', entityId: id },
        client,
      );
    });
  }

  /** A link for a doctor outside the application (MV-09): expiring, coded, revocable. */
  async createLink(ownerId: string, input: LinkInputDto): Promise<LinkCreatedDto> {
    const owned = await this.vault.byIds(input.recordIds);
    if (owned.length === 0 || owned.some((row) => row.ownerId !== ownerId))
      throw new NotFoundException();
    const token = this.keys.newToken();
    const code = this.keys.newCode();
    const expiresAt = new Date(Date.now() + input.hours * 3_600_000);
    const id = await this.vault.createLink({
      ownerId,
      recordIds: owned.map((row) => row.id),
      tokenHash: this.keys.hash(token),
      codeHash: this.keys.hash(code),
      expiresAt,
    });
    await this.audit.record({
      action: 'external_share.created',
      entity: 'external_share',
      entityId: id,
    });
    return { id, token, code, expiresAt };
  }

  async revokeLink(ownerId: string, id: string): Promise<void> {
    if (!(await this.vault.revokeLink(ownerId, id))) throw new NotFoundException();
  }

  async openLink(token: string, code: string): Promise<Plain<SharedRecordsDto>> {
    const link = await this.vault.linkByToken(this.keys.hash(token));
    if (!link || link.revokedAt || link.expiresAt < new Date()) throw new NotFoundException();
    if (link.attempts >= MAX_LINK_ATTEMPTS) throw reason(ForbiddenException, 'code_locked');
    if (!this.keys.matches(code, link.codeHash)) {
      await this.vault.failLink(link.id);
      throw reason(BadRequestException, 'code_incorrect');
    }
    const rows = (await this.vault.byIds(link.recordIds)).filter(
      (row) => row.ownerId === link.ownerId,
    );
    const files = [];
    for (const row of rows) {
      await this.vault.logAccess({
        recordId: row.id,
        accessorId: null,
        role: 'external_doctor',
        linkId: link.id,
      });
      const file = row.objectId ? await this.uploads.read(row.objectId) : undefined;
      if (file) files.push({ recordId: row.id, ...file });
    }
    return { records: await Promise.all(rows.map((row) => this.view(row))), history: [], files };
  }

  async accessLog(ownerId: string, id: string) {
    await this.mustOwn(ownerId, id);
    return this.vault.accessLog(id);
  }

  /** The whole vault as JSON for the owner (MV-12); files are downloaded one by one. */
  async export(ownerId: string) {
    const [records, history] = await Promise.all([this.list(ownerId, {}), this.history(ownerId)]);
    await this.audit.record({ action: 'vault.exported', entity: 'vault', entityId: ownerId });
    return { exportedAt: new Date(), records, history };
  }

  private async view(row: RecordRow): Promise<Plain<RecordDto>> {
    const details = JSON.parse(await this.encryptor.decrypt(row.details)) as RecordDetails;
    return {
      id: row.id,
      personId: row.personId,
      source: row.source,
      recordType: row.recordType,
      recordDate: row.recordDate,
      title: details.title,
      facility: details.facility ?? null,
      tags: details.tags ?? [],
      notes: details.notes ?? null,
      visitNotes: details.visitNotes ?? null,
      issuedBy: row.issuedBy,
      hasFile: row.objectId !== null,
      createdAt: row.createdAt,
    };
  }

  private matchesFilters(row: RecordRow, query: VaultQueryDto): boolean {
    if (query.person === 'self' && row.personId !== null) return false;
    if (query.person && query.person !== 'self' && row.personId !== query.person) return false;
    if (query.type && row.recordType !== query.type) return false;
    if (query.from && row.recordDate < query.from) return false;
    return !(query.to && row.recordDate > query.to);
  }

  private encrypt(details: RecordDetails): Promise<EncryptedField> {
    return this.encryptor.encrypt(JSON.stringify(details), 'health');
  }

  private async mustOwn(ownerId: string, id: string): Promise<RecordRow> {
    const row = await this.vault.owned(ownerId, id);
    if (!row) throw new NotFoundException();
    return row;
  }

  private async assertPerson(ownerId: string, personId: string | undefined): Promise<void> {
    if (!personId) return;
    const { rows } = await this.pool.query(
      'SELECT 1 FROM app.linked_patient WHERE id = $1 AND owner_account_id = $2',
      [personId, ownerId],
    );
    if (rows.length === 0) throw new NotFoundException();
  }

  private async assertQuota(ownerId: string, adding: number): Promise<void> {
    const usage = await this.usage(ownerId);
    if (usage.usedBytes + adding > usage.quotaBytes)
      throw reason(PayloadTooLargeException, 'vault_quota');
  }
}
