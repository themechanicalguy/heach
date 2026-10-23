import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { currentContext } from '../common/request-context.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';

export interface AuditEvent {
  /** Dotted verb, for example `sample_note.read` or `sample_note.read.denied`. */
  action: string;
  entity: string;
  /** An opaque ID only; never a name, number or Restricted value (SE-05.2). */
  entityId: string | null;
}

/**
 * Appends to the hash-chained audit log through audit.append, the only write the API role has
 * (SE-05.4). Actor, role and correlation ID come from the request context; a system job with no
 * user is recorded as role `system` with the job's name as actor (spec 005 D-4).
 */
@Injectable()
export class AuditService {
  constructor(@Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>) {}

  async record(event: AuditEvent, client: Pick<pg.Pool, 'query'> = this.pool): Promise<void> {
    const context = currentContext();
    const principal = context?.principal;
    const system = principal ? undefined : context?.system;
    await client.query('SELECT audit.append($1, $2, $3, $4, $5, $6)', [
      principal?.userId ?? system ?? null,
      principal?.role ?? (system ? 'system' : 'anonymous'),
      event.action,
      event.entity,
      event.entityId,
      context?.correlationId ?? 'none',
    ]);
  }
}
