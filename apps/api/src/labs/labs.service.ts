import { randomBytes } from 'node:crypto';
import type { FieldEncryptor } from '@heach/crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type pg from 'pg';
import type { SmsTemplate } from '../adapters/sms.port.js';
import { actorOf } from '../bookings/booking-actor.js';
import { BookingEffects, type Effects, noEffects } from '../bookings/booking-effects.js';
import { BookingLifecycle } from '../bookings/booking-lifecycle.js';
import { BookingRepository, type BookingRow } from '../bookings/booking.repository.js';
import { providerEarning } from '../bookings/fees.js';
import {
  type LabOrderRow,
  LabOrdersRepository,
  type LabStage,
} from '../bookings/lab-orders.repository.js';
import { reason } from '../common/error-response.js';
import type { Plain } from '../common/plain.js';
import type { Principal } from '../common/request-context.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { LedgerService } from '../payouts/ledger.service.js';
import { type StoredFile, UploadsService } from '../uploads/uploads.service.js';
import { VaultFiling } from '../vault/vault-filing.js';
import { VisitCodes } from '../visits/visit-codes.js';
import type { CollectorDto, LabDashboardDto, LabOrderDto, ReportUploadDto } from './labs.dto.js';

const SAMPLE_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const COLLECT = 'collect';
const COLLECTABLE = new Set(['confirmed', 'in_progress']);

/** A booking-linked sample identifier (LB-06), e.g. HX-4K7Q2M9WZB. */
export function newSampleId(): string {
  return `HX-${[...randomBytes(10)].map((byte) => SAMPLE_ALPHABET[byte % SAMPLE_ALPHABET.length]).join('')}`;
}

/**
 * Lab orders after acceptance (J7; LB-05 to LB-11): the lab assigns one of its collectors, the
 * patient's code confirms collection and creates the sample identifier, the lab receives the
 * sample and uploads the report against that identifier. Every stage is an event and a message;
 * the report is Restricted and readable only by the booker and the lab (LB-08).
 */
@Injectable()
export class LabsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>,
    private readonly bookings: BookingRepository,
    private readonly orders: LabOrdersRepository,
    private readonly lifecycle: BookingLifecycle,
    private readonly effects: BookingEffects,
    private readonly ledger: LedgerService,
    private readonly uploads: UploadsService,
    private readonly codes: VisitCodes,
    private readonly filing: VaultFiling,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
  ) {}

  async assignCollector(lab: Principal, bookingId: string, collectorId: string): Promise<void> {
    if (!(await this.collectors(lab.userId)).some((collector) => collector.id === collectorId))
      throw reason(BadRequestException, 'collector_not_in_lab');
    await this.change(lab, bookingId, (booking, order) => {
      if (
        !COLLECTABLE.has(booking.status) ||
        order.collection !== 'home' ||
        !['booked', 'collector_assigned'].includes(order.stage)
      )
        return undefined;
      return { stage: 'collector_assigned', collectorId, message: 'lab_collector_assigned' };
    });
  }

  /** The patient's code confirms the sample is taken (LB-06), by the collector or at the lab. */
  async collect(actor: Principal, bookingId: string, code: string): Promise<string> {
    if (!this.codes.matches(bookingId, COLLECT, code))
      throw reason(BadRequestException, 'code_incorrect');
    const sampleId = newSampleId();
    const effects = await this.bookings.transaction(async (client) => {
      const { booking, order } = await this.locked(client, bookingId);
      const collector =
        order.collection === 'home'
          ? order.collectorId === actor.userId
          : booking.providerId === actor.userId;
      if (!collector) throw new NotFoundException();
      const ready =
        order.collection === 'home'
          ? order.stage === 'collector_assigned'
          : order.stage === 'booked';
      if (!COLLECTABLE.has(booking.status) || !ready)
        throw reason(ConflictException, 'no_code_now');
      await this.orders.setStage(
        client,
        bookingId,
        { stage: 'sample_collected', sampleId },
        null,
        actor.role,
      );
      // A re-collection (LB-10) finds the booking already in progress.
      if (booking.status === 'confirmed')
        await this.lifecycle.apply(client, booking, 'start', actorOf(actor));
      return this.tell(booking, 'lab_sample_collected');
    });
    await this.effects.run(effects);
    return sampleId;
  }

  async received(lab: Principal, bookingId: string): Promise<void> {
    await this.change(lab, bookingId, (_booking, order) =>
      order.stage === 'sample_collected'
        ? { stage: 'received', message: 'lab_sample_received' }
        : undefined,
    );
  }

  /** Re-collection (LB-10): the sample is discarded, a new one is taken with a new identifier. */
  async recollect(lab: Principal, bookingId: string, why: string): Promise<void> {
    await this.change(lab, bookingId, (_booking, order) =>
      ['sample_collected', 'received'].includes(order.stage)
        ? {
            stage: order.collection === 'home' ? 'collector_assigned' : 'booked',
            sampleId: null,
            recollect: true,
            reason: why,
            message: 'lab_collector_assigned',
          }
        : undefined,
    );
  }

  /** The report against the sample's identifier (LB-08); a later upload is a correction (LB-10). */
  async report(lab: Principal, bookingId: string, input: ReportUploadDto): Promise<void> {
    if (input.contentType !== 'application/pdf') throw reason(BadRequestException, 'upload_type');
    const prepared = await this.uploads.prepare(lab.userId, 'lab_report', input);
    if (prepared.verdict === 'infected') throw reason(BadRequestException, 'upload_infected');
    const before = await this.bookings.find(bookingId);
    if (before?.providerId !== lab.userId) throw new NotFoundException();
    const tests = (await this.orders.items(bookingId, 'en')).map((item) => item.name);
    const filing = await this.filing.prepare(before, {
      tags: tests,
      notes: input.correctionReason ? `Corrected: ${input.correctionReason}` : null,
    });
    const effects = await this.bookings.transaction(async (client) => {
      const { booking, order } = await this.locked(client, bookingId);
      if (booking.providerId !== lab.userId) throw new NotFoundException();
      if (order.sampleId !== input.sampleId) throw reason(BadRequestException, 'sample_mismatch');
      const correcting = order.stage === 'report_ready';
      if (!correcting && order.stage !== 'received')
        throw reason(ConflictException, 'no_report_now');
      if (correcting && !input.correctionReason)
        throw reason(BadRequestException, 'correction_reason_required');
      await this.uploads.record(client, prepared);
      await this.orders.addReport(
        client,
        bookingId,
        prepared.id,
        correcting ? (input.correctionReason ?? null) : null,
      );
      // Filed into the patient's vault; a correction replaces the filed report (MV-02, LB-09).
      await this.filing.file(client, booking, {
        source: 'lab',
        recordType: 'lab_report',
        details: filing,
        objectId: prepared.id,
      });
      if (!correcting) {
        await this.orders.setStage(client, bookingId, { stage: 'report_ready' }, null, lab.role);
        await this.lifecycle.apply(client, booking, 'complete', actorOf(lab));
        await this.ledger.earn(client, {
          providerId: lab.userId,
          bookingId,
          amountPaise: providerEarning(booking),
          kind: 'earning',
          at: new Date(),
        });
      }
      return this.tell(booking, 'lab_report_ready');
    });
    await this.effects.run(effects);
  }

  /** The latest report, for the booker or the lab only (LB-08). */
  async reportFile(accountId: string, bookingId: string): Promise<StoredFile> {
    const booking = await this.bookings.find(bookingId);
    if (!booking || (booking.bookerId !== accountId && booking.providerId !== accountId))
      throw new NotFoundException();
    const [latest] = await this.orders.reports(bookingId);
    const file = latest && (await this.uploads.read(latest.objectId));
    if (!file) throw new NotFoundException();
    return file;
  }

  async codeFor(bookerId: string, bookingId: string): Promise<{ code: string; moment: string }> {
    const booking = await this.bookings.find(bookingId);
    const order = await this.orders.find(bookingId);
    if (booking?.bookerId !== bookerId || !order) throw new NotFoundException();
    const ready =
      order.collection === 'home' ? order.stage === 'collector_assigned' : order.stage === 'booked';
    if (!COLLECTABLE.has(booking.status) || !ready) throw reason(ConflictException, 'no_code_now');
    return { code: this.codes.code(bookingId, COLLECT), moment: COLLECT };
  }

  async forPatient(bookerId: string, bookingId: string, locale: string): Promise<LabOrderDto> {
    const booking = await this.bookings.find(bookingId);
    if (booking?.bookerId !== bookerId) throw new NotFoundException();
    return this.view(booking, locale, false);
  }

  async forLab(labId: string, locale: string): Promise<LabOrderDto[]> {
    const rows = (await this.bookings.forProvider(labId)).filter(
      (booking) => booking.kind === 'lab_test' && booking.status !== 'requested',
    );
    return Promise.all(rows.map((booking) => this.view(booking, locale, false)));
  }

  /** Home collections assigned to this collector, with the address (HS-02 for collectors). */
  async forCollector(collectorId: string, locale: string): Promise<LabOrderDto[]> {
    const { rows } = await this.pool.query<{ booking_id: string }>(
      `SELECT booking_id FROM app.lab_order WHERE collector_account_id = $1 AND stage = 'collector_assigned'`,
      [collectorId],
    );
    const bookings = await Promise.all(rows.map((row) => this.bookings.find(row.booking_id)));
    return Promise.all(
      bookings
        .filter((booking): booking is BookingRow => booking?.status === 'confirmed')
        .map((booking) => this.view(booking, locale, true)),
    );
  }

  /** Active, approved collectors of the lab this account owns (O-1, LB-05). */
  async collectors(labId: string): Promise<CollectorDto[]> {
    const { rows } = await this.pool.query<CollectorDto>(
      `SELECT m.account_id AS id, coalesce(p.full_name, '') AS name,
              EXISTS (SELECT 1 FROM app.identity_check c WHERE c.account_id = m.account_id AND c.status = 'verified') AS verified
         FROM app.membership m JOIN app.organisation o ON o.id = m.organisation_id
         JOIN app.role_assignment r ON r.account_id = m.account_id AND r.role = 'sample_collector' AND r.application_status = 'approved'
         LEFT JOIN app.account_profile p ON p.account_id = m.account_id
        WHERE o.owner_account_id = $1 AND m.role = 'sample_collector' AND m.status = 'active'`,
      [labId],
    );
    return rows;
  }

  /** Today's collections, pending reports and turnaround against the promise (LB-11, AD-13). */
  async dashboard(labId: string): Promise<Plain<LabDashboardDto>> {
    const { rows } = await this.pool.query<Plain<LabDashboardDto>>(
      `SELECT count(*) FILTER (WHERE (b.starts_at AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date)::int AS "todayCollections",
              count(*) FILTER (WHERE o.stage IN ('sample_collected', 'received'))::int AS "pendingReports",
              round(avg(extract(epoch FROM (r.created_at - o.collected_at)) / 3600)::numeric, 1)::float AS "averageTurnaroundHours",
              count(*) FILTER (WHERE r.created_at > o.collected_at + make_interval(hours => o.report_hours))::int AS "lateReports"
         FROM app.lab_order o JOIN app.booking b ON b.id = o.booking_id
         LEFT JOIN app.lab_report r ON r.booking_id = o.booking_id AND r.version = 1
        WHERE b.provider_account_id = $1`,
      [labId],
    );
    return (
      rows[0] ?? {
        todayCollections: 0,
        pendingReports: 0,
        averageTurnaroundHours: null,
        lateReports: 0,
      }
    );
  }

  private async view(
    booking: BookingRow,
    locale: string,
    withAddress: boolean,
  ): Promise<LabOrderDto> {
    const order = await this.orders.find(booking.id);
    if (!order) throw new NotFoundException();
    const [items, events, reports, collector] = await Promise.all([
      this.orders.items(booking.id, locale),
      this.orders.events(booking.id),
      this.orders.reports(booking.id),
      order.collectorId ? this.collectorOf(order.collectorId) : Promise.resolve(null),
    ]);
    return {
      bookingId: booking.id,
      status: booking.status,
      collection: order.collection,
      stage: order.stage,
      startsAt: booking.startsAt,
      items,
      collector,
      sampleId: order.sampleId,
      reportHours: order.reportHours,
      reportDueAt: order.collectedAt
        ? new Date(order.collectedAt.getTime() + order.reportHours * 3_600_000)
        : null,
      events,
      reports: reports.map(({ version, correctionReason, createdAt }) => ({
        version,
        correctionReason,
        createdAt,
      })),
      address: withAddress ? await this.encryptor.decrypt(booking.address) : null,
    };
  }

  private async collectorOf(accountId: string): Promise<CollectorDto> {
    const { rows } = await this.pool.query<CollectorDto>(
      `SELECT a.id, coalesce(p.full_name, '') AS name,
              EXISTS (SELECT 1 FROM app.identity_check c WHERE c.account_id = a.id AND c.status = 'verified') AS verified
         FROM app.account a LEFT JOIN app.account_profile p ON p.account_id = a.id WHERE a.id = $1`,
      [accountId],
    );
    return rows[0] ?? { id: accountId, name: '', verified: false };
  }

  private async locked(
    client: TransactionClient,
    bookingId: string,
  ): Promise<{ booking: BookingRow; order: LabOrderRow }> {
    const booking = await this.bookings.lock(client, bookingId);
    const order = booking && (await this.orders.lock(client, bookingId));
    if (!booking || !order) throw new NotFoundException();
    return { booking, order };
  }

  /** A lab-side stage change on the lab's own order, recorded and told to the patient. */
  private async change(
    lab: Principal,
    bookingId: string,
    decide: (
      booking: BookingRow,
      order: LabOrderRow,
    ) =>
      | {
          stage: LabStage;
          collectorId?: string;
          sampleId?: null;
          recollect?: boolean;
          reason?: string;
          message: SmsTemplate;
        }
      | undefined,
  ): Promise<void> {
    const effects = await this.bookings.transaction(async (client) => {
      const { booking, order } = await this.locked(client, bookingId);
      if (booking.providerId !== lab.userId) throw new NotFoundException();
      const next = decide(booking, order);
      if (!next) throw reason(ConflictException, 'lab_stage_refused');
      const { message, reason: why, ...change } = next;
      await this.orders.setStage(client, bookingId, change, why ?? null, lab.role);
      return this.tell(booking, message);
    });
    await this.effects.run(effects);
  }

  private tell(booking: BookingRow, template: SmsTemplate): Effects {
    const effects = noEffects();
    effects.messages.push({ to: booking.bookerId, template, bookingId: booking.id });
    return effects;
  }
}
