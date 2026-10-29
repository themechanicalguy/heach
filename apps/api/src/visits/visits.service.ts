import type { FieldEncryptor } from '@heach/crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { actorOf, SYSTEM } from '../bookings/booking-actor.js';
import { BookingEffects, type Effects, noEffects } from '../bookings/booking-effects.js';
import { BookingLifecycle } from '../bookings/booking-lifecycle.js';
import { BookingRepository, type BookingRow } from '../bookings/booking.repository.js';
import { PROVIDER_NO_SHOW_JOB } from '../bookings/dispatch.service.js';
import { providerEarning } from '../bookings/fees.js';
import { StrikesService } from '../bookings/strikes.service.js';
import { reason } from '../common/error-response.js';
import type { Plain } from '../common/plain.js';
import type { Principal } from '../common/request-context.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { JobRunner } from '../jobs/runner/job-runner.js';
import { RefundsService } from '../payments/refunds.service.js';
import { LedgerService } from '../payouts/ledger.service.js';
import { Settings } from '../settings/settings.service.js';
import { VisitCodes } from './visit-codes.js';
import {
  noShowSplit,
  patientNoShowAllowed,
  providerNoShowAllowed,
  shiftShare,
  startWindowOpen,
} from './visit-rules.js';
import type { VisitCodeDto, VisitNotesDto } from './visits.dto.js';
import { type ShiftRow, VisitsRepository } from './visits.repository.js';

const MAX_CODE_ATTEMPTS = 5;

/**
 * The visit itself (J3, J4; HS-03 to HS-05): the patient's one-time code starts a visit or checks
 * a shift in and out; visit notes are encrypted and complete the booking, which earns the
 * provider (PY-04); each completed shift earns its share (PK-07). Absences follow A12 and A15.
 */
@Injectable()
export class VisitsService implements OnModuleInit {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly visits: VisitsRepository,
    private readonly lifecycle: BookingLifecycle,
    private readonly effects: BookingEffects,
    private readonly codes: VisitCodes,
    private readonly ledger: LedgerService,
    private readonly refunds: RefundsService,
    private readonly strikes: StrikesService,
    private readonly settings: Settings,
    private readonly jobs: JobRunner,
    private readonly audit: AuditService,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
  ) {}

  onModuleInit(): void {
    this.jobs.register(PROVIDER_NO_SHOW_JOB, (payload) =>
      this.providerAbsent(payload.bookingId ?? '', SYSTEM),
    );
  }

  /** The code the patient shows now, if a visit or shift can start or end (HS-03, HS-05). */
  async codeFor(bookerId: string, bookingId: string, now = new Date()): Promise<VisitCodeDto> {
    const booking = await this.bookings.find(bookingId);
    if (booking?.bookerId !== bookerId) throw new NotFoundException();
    const moment = await this.currentMoment(booking, now);
    if (!moment) throw reason(ConflictException, 'no_code_now');
    return { code: this.codes.code(bookingId, moment), moment };
  }

  async start(
    principal: Principal,
    bookingId: string,
    code: string,
    now = new Date(),
  ): Promise<void> {
    // The code is checked first, outside the transaction: a wrong one must count even though
    // the request then fails, and the count must not wait on the booking's row lock.
    const before = await this.bookings.find(bookingId);
    if (before?.providerId !== principal.userId) throw new NotFoundException();
    await this.checkCode(bookingId, 'visit', code);
    const effects = await this.bookings.transaction(async (client) => {
      const booking = await this.mine(client, principal, bookingId);
      if (booking.kind === 'shift') throw reason(BadRequestException, 'use_shift_check_in');
      if (booking.status !== 'confirmed' || !startWindowOpen(booking.startsAt, now))
        throw reason(ConflictException, 'no_code_now');
      await this.lifecycle.apply(client, booking, 'start', actorOf(principal));
      await this.visits.start(client, bookingId);
      return this.tell(booking, 'visit_started');
    });
    await this.effects.run(effects);
  }

  async complete(principal: Principal, bookingId: string, notes: VisitNotesDto): Promise<void> {
    const encrypted = await this.encryptor.encrypt(JSON.stringify(notes), 'health');
    const effects = await this.bookings.transaction(async (client) => {
      const booking = await this.mine(client, principal, bookingId);
      if (booking.kind === 'shift' || booking.status !== 'in_progress')
        throw reason(ConflictException, 'booking_transition_refused');
      await this.visits.complete(client, bookingId, encrypted);
      await this.lifecycle.apply(client, booking, 'complete', actorOf(principal));
      await this.ledger.earn(client, {
        providerId: principal.userId,
        bookingId,
        amountPaise: providerEarning(booking),
        kind: 'earning',
        at: new Date(),
      });
      await this.audit.record(
        { action: 'visit_note.created', entity: 'booking', entityId: bookingId },
        client,
      );
      return this.tell(booking, 'visit_completed');
    });
    await this.effects.run(effects);
  }

  async checkShift(
    principal: Principal,
    bookingId: string,
    day: number,
    phase: 'in' | 'out',
    code: string,
    now = new Date(),
  ) {
    const shift = (await this.visits.shifts(bookingId)).find((row) => row.dayIndex === day);
    if (shift?.attendantId !== principal.userId) throw new NotFoundException();
    await this.checkCode(bookingId, `shift:${String(day)}:${phase}`, code);
    const effects = await this.bookings.transaction(async (client) => {
      const booking = await this.bookings.lock(client, bookingId);
      const locked = booking && (await this.visits.lockShift(client, bookingId, day));
      if (!booking || locked?.attendantId !== principal.userId) throw new NotFoundException();
      if (phase === 'in') return this.checkIn(client, principal, booking, locked, now);
      return this.checkOut(client, principal, booking, locked);
    });
    await this.effects.run(effects);
  }

  /** The patient was not there after the wait (A15): the fee share to the provider, the rest back. */
  async patientAbsent(principal: Principal, bookingId: string, now = new Date()): Promise<void> {
    const wait = await this.settings.get('no_show_wait_minutes');
    const effects = await this.bookings.transaction(async (client) => {
      const booking = await this.mine(client, principal, bookingId);
      if (booking.status !== 'confirmed' || !patientNoShowAllowed(booking.startsAt, now, wait))
        throw reason(ConflictException, 'no_show_too_early');
      const paid = booking.paidPaise - booking.refundedPaise;
      const split = noShowSplit(
        paid,
        await this.settings.get('patient_no_show_fee_percent'),
        await this.settings.get('commission_bps'),
      );
      await this.lifecycle.apply(
        client,
        booking,
        'no_show_patient',
        actorOf(principal),
        'patient_absent',
      );
      await this.ledger.earn(client, {
        providerId: principal.userId,
        bookingId,
        amountPaise: split.providerPaise,
        kind: 'no_show_fee',
        at: now,
      });
      const result = noEffects();
      if (split.refundPaise > 0) {
        await this.refunds.plan(client, {
          bookingId,
          amountPaise: split.refundPaise,
          reason: 'no_show',
          actorRole: principal.role,
        });
        result.refundBookings.push(bookingId);
      }
      result.messages.push({
        to: booking.bookerId,
        template: 'booking_cancelled',
        params: { time: booking.startsAt.toISOString() },
        bookingId,
      });
      return result;
    });
    await this.effects.run(effects);
  }

  /** The provider did not come (A12): a full refund and a strike. */
  async providerAbsent(
    bookingId: string,
    actor: ReturnType<typeof actorOf>,
    now = new Date(),
  ): Promise<void> {
    const effects = await this.bookings.transaction(async (client) => {
      const booking = await this.bookings.lock(client, bookingId);
      if (booking?.status !== 'confirmed' || !booking.providerId) return noEffects();
      if (
        actor.kind === 'patient' &&
        (booking.bookerId !== actor.id || !providerNoShowAllowed(booking.startsAt, now))
      ) {
        throw reason(ConflictException, 'no_show_too_early');
      }
      if (
        booking.kind === 'shift' &&
        (await this.visits.shifts(bookingId, client)).some((shift) => shift.status !== 'scheduled')
      )
        return noEffects();
      await this.lifecycle.apply(client, booking, 'no_show_provider', actor, 'provider_absent');
      await this.strikes.record(client, {
        providerId: booking.providerId,
        bookingId,
        reason: 'no_show',
      });
      const paid = booking.paidPaise - booking.refundedPaise;
      const result = noEffects();
      if (paid > 0) {
        await this.refunds.plan(client, {
          bookingId,
          amountPaise: paid,
          reason: 'no_show',
          actorRole: actor.role,
        });
        result.refundBookings.push(bookingId);
      }
      result.messages.push({
        to: booking.bookerId,
        template: 'booking_cancelled',
        params: { time: booking.startsAt.toISOString() },
        bookingId,
      });
      return result;
    });
    await this.effects.run(effects);
  }

  async shifts(accountId: string, bookingId: string): Promise<ShiftRow[]> {
    const booking = await this.bookings.find(bookingId);
    if (!booking || (booking.bookerId !== accountId && booking.providerId !== accountId))
      throw new NotFoundException();
    return this.visits.shifts(bookingId);
  }

  /** The patient's own copy of the visit notes (HS-04; filed to the vault in Step 8). */
  async notesFor(
    bookerId: string,
    bookingId: string,
  ): Promise<(VisitNotesDto & { completedAt: Date }) | undefined> {
    const booking = await this.bookings.find(bookingId);
    if (booking?.bookerId !== bookerId) throw new NotFoundException();
    const record = await this.visits.record(bookingId);
    if (!record?.notes || !record.completedAt) return undefined;
    const notes = JSON.parse(await this.encryptor.decrypt(record.notes)) as Plain<VisitNotesDto>;
    await this.audit.record({ action: 'visit_note.read', entity: 'booking', entityId: bookingId });
    return { ...notes, completedAt: record.completedAt };
  }

  private async checkIn(
    client: TransactionClient,
    principal: Principal,
    booking: BookingRow,
    shift: ShiftRow,
    now: Date,
  ): Promise<Effects> {
    const open = now.getTime() >= shift.startsAt.getTime() - 30 * 60_000 && now < shift.endsAt;
    if (shift.status !== 'scheduled' || !open) throw reason(ConflictException, 'no_code_now');
    if (booking.paidPaise < booking.totalPaise) throw reason(ConflictException, 'balance_due');
    await this.visits.setShift(client, shift.id, 'checked_in');
    if (booking.status === 'confirmed')
      await this.lifecycle.apply(client, booking, 'start', actorOf(principal));
    return shift.dayIndex === 0 ? this.tell(booking, 'visit_started') : noEffects();
  }

  private async checkOut(
    client: TransactionClient,
    principal: Principal,
    booking: BookingRow,
    shift: ShiftRow,
  ): Promise<Effects> {
    if (shift.status !== 'checked_in') throw reason(ConflictException, 'no_code_now');
    await this.visits.setShift(client, shift.id, 'checked_out');
    const amountPaise = shiftShare(providerEarning(booking), booking.shiftDays, shift.dayIndex);
    await this.ledger.earn(client, {
      providerId: principal.userId,
      bookingId: booking.id,
      amountPaise,
      kind: 'earning',
      at: new Date(),
      sessionKey: `shift:${String(shift.dayIndex)}`,
    });
    const remaining = (await this.visits.shifts(booking.id, client)).filter(
      (row) => row.status === 'scheduled' || row.status === 'checked_in',
    );
    if (remaining.length > 0) return noEffects();
    const current = await this.bookings.find(booking.id, client);
    if (current) await this.lifecycle.apply(client, current, 'complete', actorOf(principal));
    return this.tell(booking, 'visit_completed');
  }

  private async currentMoment(booking: BookingRow, now: Date): Promise<string | undefined> {
    if (booking.kind !== 'shift')
      return booking.status === 'confirmed' && startWindowOpen(booking.startsAt, now)
        ? 'visit'
        : undefined;
    const shifts = await this.visits.shifts(booking.id);
    const open = shifts.find((shift) => shift.status === 'checked_in');
    if (open) return `shift:${String(open.dayIndex)}:out`;
    const next = shifts.find(
      (shift) =>
        shift.status === 'scheduled' &&
        now.getTime() >= shift.startsAt.getTime() - 30 * 60_000 &&
        now < shift.endsAt,
    );
    return next ? `shift:${String(next.dayIndex)}:in` : undefined;
  }

  private async checkCode(bookingId: string, moment: string, code: string): Promise<void> {
    if ((await this.visits.attempts(bookingId)) >= MAX_CODE_ATTEMPTS)
      throw reason(ForbiddenException, 'code_locked');
    if (!this.codes.matches(bookingId, moment, code)) {
      await this.visits.failedCode(bookingId);
      throw reason(BadRequestException, 'code_incorrect');
    }
  }

  private async mine(
    client: TransactionClient,
    principal: Principal,
    bookingId: string,
  ): Promise<BookingRow> {
    const booking = await this.bookings.lock(client, bookingId);
    if (booking?.providerId !== principal.userId) throw new NotFoundException();
    return booking;
  }

  private tell(booking: BookingRow, template: 'visit_started' | 'visit_completed'): Effects {
    const effects = noEffects();
    effects.messages.push({ to: booking.bookerId, template, bookingId: booking.id });
    return effects;
  }
}
