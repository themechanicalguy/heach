import { randomUUID } from 'node:crypto';
import type { EncryptedField, FieldEncryptor } from '@heach/crypto';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type pg from 'pg';
import { AuditService } from '../audit/audit.service.js';
import { reason } from '../common/error-response.js';
import type { Principal } from '../common/request-context.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { ALERT_PUBLISHER, type AlertPublisher } from '../security/alert-publisher.js';
import type {
  AccessEntryDto,
  TicketDto,
  TicketInputDto,
  TicketRestrictedDto,
} from './tickets.dto.js';

type Queryable = Pick<pg.Pool, 'query'>;
const GRANT_MINUTES = 30;
const PRIORITY = { safety: 'p0', complaint: 'high', help: 'normal' } as const;
const COLUMNS = `id, booking_id AS "bookingId", kind, priority, topic, status, resolution,
  raised_by_role AS "raisedByRole", created_at AS "createdAt", updated_at AS "updatedAt"`;

/**
 * Safety concerns, complaints and help requests (HS-06, RF-03, AD-06). A safety concern is P0
 * and alerts operations at once (A17: the clinical emergency runbook). The description and
 * admin notes are Restricted: an admin reads them only through a break-glass grant tied to the
 * ticket, with a reason and a 30-minute limit, which the patient can see (SE-03, SE-06).
 */
@Injectable()
export class TicketsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    private readonly audit: AuditService,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
    @Inject(ALERT_PUBLISHER) private readonly alerts: AlertPublisher,
  ) {}

  async raise(principal: Principal, input: TicketInputDto): Promise<TicketDto> {
    if (input.bookingId) await this.assertParty(principal.userId, input.bookingId);
    const description = input.description
      ? await this.encryptor.encrypt(input.description, 'health')
      : null;
    const id = await this.insert(this.pool, {
      bookingId: input.bookingId,
      kind: input.kind,
      topic: input.topic,
      priority: PRIORITY[input.kind],
      description,
      raisedBy: principal.userId,
      role: principal.role,
    });
    if (input.kind === 'safety') {
      await this.alerts.publish(
        'Safety concern raised',
        `Ticket ${id} needs a response now (HS-06).`,
      );
    }
    return this.view(id);
  }

  /** A ticket raised by the system (a strike review), in the caller's transaction. */
  async raiseSystem(
    client: TransactionClient,
    input: { bookingId: string; kind: 'strike_review'; topic: string },
  ): Promise<string> {
    return this.insert(client, {
      ...input,
      priority: 'high',
      description: null,
      raisedBy: null,
      role: 'system',
    });
  }

  async mine(accountId: string): Promise<TicketDto[]> {
    const { rows } = await this.pool.query<TicketDto>(
      `SELECT ${COLUMNS} FROM app.ticket WHERE raised_by = $1 ORDER BY created_at DESC LIMIT 50`,
      [accountId],
    );
    return rows;
  }

  async queue(status?: string): Promise<TicketDto[]> {
    const { rows } = await this.pool.query<TicketDto>(
      `SELECT ${COLUMNS} FROM app.ticket WHERE ($1::text IS NULL AND status <> 'resolved' OR status = $1)
        ORDER BY CASE priority WHEN 'p0' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, created_at LIMIT 200`,
      [status ?? null],
    );
    return rows;
  }

  async view(id: string): Promise<TicketDto> {
    const { rows } = await this.pool.query<TicketDto>(
      `SELECT ${COLUMNS} FROM app.ticket WHERE id = $1`,
      [id],
    );
    const ticket = rows[0];
    if (!ticket) throw new NotFoundException();
    return ticket;
  }

  async assign(admin: Principal, id: string): Promise<void> {
    await this.update(
      id,
      `status = 'assigned', assignee_admin_id = $2`,
      [admin.userId],
      'ticket.assigned',
    );
  }

  async resolve(id: string, resolution: string): Promise<void> {
    await this.update(id, `status = 'resolved', resolution = $2`, [resolution], 'ticket.resolved');
  }

  async note(admin: Principal, id: string, note: string): Promise<void> {
    await this.view(id);
    const body = await this.encryptor.encrypt(note, 'health');
    await this.pool.query(
      'INSERT INTO app.ticket_note (id, ticket_id, admin_id, body) VALUES ($1, $2, $3, $4)',
      [randomUUID(), id, admin.userId, body],
    );
    await this.audit.record({ action: 'ticket.noted', entity: 'ticket', entityId: id });
  }

  /** Break-glass (SE-03): a 30-minute, audited grant to read this ticket's Restricted content. */
  async breakGlass(admin: Principal, id: string, why: string): Promise<void> {
    await this.view(id);
    const subject = await this.subjectOf(id);
    await this.pool.query(
      `INSERT INTO app.access_grant (id, admin_id, admin_role, ticket_id, subject_account_id, reason, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, now() + make_interval(mins => $7))`,
      [randomUUID(), admin.userId, admin.role, id, subject, why, GRANT_MINUTES],
    );
    await this.audit.record({ action: 'break_glass.granted', entity: 'ticket', entityId: id });
  }

  async restricted(admin: Principal, id: string): Promise<TicketRestrictedDto> {
    const { rows } = await this.pool.query<{ expires_at: Date }>(
      `SELECT expires_at FROM app.access_grant WHERE ticket_id = $1 AND admin_id = $2 AND expires_at > now()
        ORDER BY expires_at DESC LIMIT 1`,
      [id, admin.userId],
    );
    const grant = rows[0];
    if (!grant) throw reason(ForbiddenException, 'break_glass_required');
    const ticket = await this.pool.query<{ description: EncryptedField | null }>(
      'SELECT description FROM app.ticket WHERE id = $1',
      [id],
    );
    const notes = await this.pool.query<{ body: EncryptedField }>(
      'SELECT body FROM app.ticket_note WHERE ticket_id = $1 ORDER BY created_at',
      [id],
    );
    const description = ticket.rows[0]?.description;
    const result = {
      description: description ? await this.encryptor.decrypt(description) : null,
      notes: await Promise.all(notes.rows.map((row) => this.encryptor.decrypt(row.body))),
      grantExpiresAt: grant.expires_at,
    };
    await this.audit.record({ action: 'ticket.restricted_read', entity: 'ticket', entityId: id });
    return result;
  }

  /** Who looked at the account's Restricted data through break-glass, and when (SE-06). */
  async accessHistory(accountId: string): Promise<AccessEntryDto[]> {
    const { rows } = await this.pool.query<AccessEntryDto>(
      `SELECT admin_role AS "adminRole", reason, granted_at AS "grantedAt", expires_at AS "expiresAt"
         FROM app.access_grant WHERE subject_account_id = $1 ORDER BY granted_at DESC LIMIT 100`,
      [accountId],
    );
    return rows;
  }

  private async insert(
    client: Queryable,
    input: {
      bookingId?: string | undefined;
      kind: string;
      topic: string;
      priority: string;
      description: EncryptedField | null;
      raisedBy: string | null;
      role: string;
    },
  ): Promise<string> {
    const id = randomUUID();
    await client.query(
      `INSERT INTO app.ticket (id, booking_id, raised_by, raised_by_role, kind, priority, topic, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        input.bookingId ?? null,
        input.raisedBy,
        input.role,
        input.kind,
        input.priority,
        input.topic,
        input.description,
      ],
    );
    await this.audit.record(
      { action: `ticket.${input.kind}`, entity: 'ticket', entityId: id },
      client,
    );
    return id;
  }

  private async update(id: string, set: string, values: unknown[], action: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE app.ticket SET ${set}, updated_at = now() WHERE id = $1`,
      [id, ...values],
    );
    if (result.rowCount !== 1) throw new NotFoundException();
    await this.audit.record({ action, entity: 'ticket', entityId: id });
  }

  private async assertParty(accountId: string, bookingId: string): Promise<void> {
    const { rows } = await this.pool.query(
      'SELECT 1 FROM app.booking WHERE id = $1 AND (booker_account_id = $2 OR provider_account_id = $2)',
      [bookingId, accountId],
    );
    if (rows.length === 0) throw new NotFoundException();
  }

  /** The patient whose data the ticket is about: the raiser, or the booking's booker. */
  private async subjectOf(id: string): Promise<string | null> {
    const { rows } = await this.pool.query<{ subject: string | null }>(
      `SELECT coalesce(b.booker_account_id, t.raised_by) AS subject FROM app.ticket t
         LEFT JOIN app.booking b ON b.id = t.booking_id WHERE t.id = $1`,
      [id],
    );
    return rows[0]?.subject ?? null;
  }
}
