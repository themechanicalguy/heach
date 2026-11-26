import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { AuditService } from './audit.service.js';
import { auditCsv } from './audit-csv.js';
import {
  type AuditEntryDto,
  type AuditFilterDto,
  type AuditPageDto,
  type AuditSearchQueryDto,
  SEARCH_DEFAULT_LIMIT,
} from './audit-search.dto.js';

/** Most rows one export returns (AD-11). */
export const EXPORT_MAX_ROWS = 5000;

interface EntryRow {
  seq: string;
  id: string;
  at: Date;
  actor_id: string | null;
  actor_role: string;
  action: string;
  entity: string;
  entity_id: string | null;
  correlation_id: string;
}

/**
 * Super admin search and export of the audit log through audit.search, the only read the API role
 * has (AD-11). Each use is itself audited; filter values are never logged or recorded.
 */
@Injectable()
export class AuditSearchService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>,
    private readonly audit: AuditService,
  ) {}

  async search(query: AuditSearchQueryDto): Promise<AuditPageDto> {
    const limit = query.limit ?? SEARCH_DEFAULT_LIMIT;
    // One extra row tells whether another page exists.
    const rows = await this.fetch(query, query.before, limit + 1);
    const entries = rows.slice(0, limit);
    await this.audit.record({ action: 'audit.search', entity: 'audit', entityId: null });
    const last = entries.at(-1);
    return { entries, nextBefore: rows.length > limit && last ? last.seq : null };
  }

  async exportCsv(filter: AuditFilterDto): Promise<string> {
    const rows = await this.fetch(filter, undefined, EXPORT_MAX_ROWS);
    await this.audit.record({ action: 'audit.export', entity: 'audit', entityId: null });
    return auditCsv(rows);
  }

  private async fetch(
    filter: AuditFilterDto,
    before: string | undefined,
    limit: number,
  ): Promise<AuditEntryDto[]> {
    const { rows } = await this.pool.query<EntryRow>(
      'SELECT * FROM audit.search($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        filter.actorId ?? null,
        filter.actorRole ?? null,
        filter.action ?? null,
        filter.entity ?? null,
        filter.entityId ?? null,
        filter.from ?? null,
        filter.to ?? null,
        before ?? null,
        limit,
      ],
    );
    return rows.map(toEntry);
  }
}

const toEntry = (row: EntryRow): AuditEntryDto => ({
  seq: row.seq,
  id: row.id,
  at: row.at.toISOString(),
  actorId: row.actor_id,
  actorRole: row.actor_role,
  action: row.action,
  entity: row.entity,
  entityId: row.entity_id,
  correlationId: row.correlation_id,
});
