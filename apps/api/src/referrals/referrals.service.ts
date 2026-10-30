import { randomInt, randomUUID } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import type pg from 'pg';
import { AuditService } from '../audit/audit.service.js';
import { REFERRAL_QUALIFY_JOB } from '../bookings/booking-lifecycle.js';
import { reason } from '../common/error-response.js';
import type { Plain } from '../common/plain.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { type TransactionClient, withTransaction } from '../data-stores/transaction.js';
import { JobRunner } from '../jobs/runner/job-runner.js';
import { Notifier } from '../notifications/notifier.service.js';
import { LedgerService } from '../payouts/ledger.service.js';
import { Settings } from '../settings/settings.service.js';
import type { AdminReferralDto, ReferralDto } from './referrals.dto.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DAY_MS = 86_400_000;

export function newReferralCode(): string {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join(
    '',
  );
}

/**
 * Referrals and coupons (RR-01 to RR-08). Provider referrals earn commission back (RR-04). Rewards come only after the invited person's first
 * completed booking, never at sign-up (RR-03); a referrer without a care role is never rewarded,
 * so no provider earns from a patient's booking (RR-05). Self-referral, a second referral for
 * one account and more than the monthly cap are blocked or held for review (RR-06).
 */
@Injectable()
export class ReferralsService implements OnModuleInit {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    private readonly settings: Settings,
    private readonly jobs: JobRunner,
    private readonly notifier: Notifier,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(REFERRAL_QUALIFY_JOB, async (payload) => {
      await this.qualify(payload.bookingId ?? '');
      await this.qualifyProvider(payload.bookingId ?? '');
      await this.rebate(payload.bookingId ?? '');
    });
  }

  async mine(accountId: string): Promise<Plain<ReferralDto>> {
    const code = await this.codeOf(accountId);
    const invitees = await this.pool.query<{ status: string; joinedAt: Date }>(
      'SELECT status, created_at AS "joinedAt" FROM app.referral WHERE referrer_account_id = $1 ORDER BY created_at DESC LIMIT 100',
      [accountId],
    );
    const coupons = await this.pool.query<{
      id: string;
      valuePaise: number;
      expiresAt: Date;
      status: string;
    }>(
      `SELECT id, value_paise AS "valuePaise", expires_at AS "expiresAt", status FROM app.coupon
        WHERE account_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [accountId],
    );
    const invited = await this.pool.query(
      'SELECT 1 FROM app.referral WHERE invitee_account_id = $1',
      [accountId],
    );
    const credit = await this.pool.query<{ left: number }>(
      'SELECT bookings_left AS left FROM app.commission_credit WHERE account_id = $1',
      [accountId],
    );
    return {
      code,
      invitees: invitees.rows,
      coupons: coupons.rows,
      invited: invited.rows.length > 0,
      commissionCreditBookings: credit.rows[0]?.left ?? 0,
    };
  }

  /**
   * Joins with someone's code: within the window, once, never one's own (RR-06). A provider
   * joins only with another provider's code (RR-04).
   */
  async join(
    accountId: string,
    code: string,
    kind: 'patient' | 'provider',
    deviceHash: string,
  ): Promise<void> {
    const windowDays = await this.settings.get('referral_join_window_days');
    const cap = await this.settings.get('referral_monthly_cap');
    await withTransaction(this.pool, async (client) => {
      const { rows } = await client.query<{
        referrer: string;
        fresh: boolean;
        booked: boolean;
        recent: number;
        provides: boolean;
        sameDevice: boolean;
      }>(
        `SELECT rc.account_id AS referrer,
                EXISTS (SELECT 1 FROM app.role_assignment g WHERE g.account_id = rc.account_id AND g.side = 'provider') AS provides,
                EXISTS (SELECT 1 FROM app.referral d WHERE d.device_hash = $4 AND d.invitee_account_id <> $2) AS "sameDevice",
                (SELECT a.created_at > now() - make_interval(days => $3) FROM app.account a WHERE a.id = $2) AS fresh,
                EXISTS (SELECT 1 FROM app.booking b WHERE b.booker_account_id = $2 AND b.status = 'completed') AS booked,
                (SELECT count(*)::int FROM app.referral r WHERE r.referrer_account_id = rc.account_id
                   AND r.created_at > now() - interval '30 days') AS recent
           FROM app.referral_code rc WHERE rc.code = $1`,
        [code, accountId, windowDays, deviceHash],
      );
      const found = rows[0];
      if (
        !found ||
        found.referrer === accountId ||
        !found.fresh ||
        found.booked ||
        (kind === 'provider' && !found.provides)
      )
        throw reason(ConflictException, 'referral_not_allowed');
      // Over the monthly cap, or a second invitee from one device: held for review (RR-06).
      let flagReason: string | null = null;
      if (found.recent >= cap) flagReason = 'velocity';
      else if (found.sameDevice) flagReason = 'same_device';
      const inserted = await client.query(
        `INSERT INTO app.referral (id, referrer_account_id, invitee_account_id, status, flag_reason, kind, device_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (invitee_account_id) DO NOTHING`,
        [
          randomUUID(),
          found.referrer,
          accountId,
          flagReason ? 'flagged' : 'joined',
          flagReason,
          kind,
          deviceHash,
        ],
      );
      if (inserted.rowCount !== 1) throw reason(ConflictException, 'referral_not_allowed');
      await this.audit.record(
        { action: 'referral.joined', entity: 'referral', entityId: accountId },
        client,
      );
    });
  }

  /** After a booking completes: the booker's first completion rewards their referral (RR-02, RR-03). */
  async qualify(bookingId: string): Promise<void> {
    const issued = await withTransaction(this.pool, async (client) => {
      const { rows } = await client.query<{
        id: string;
        referrer: string;
        invitee: string;
        referrer_cares: boolean;
        completed: number;
      }>(
        `SELECT r.id, r.referrer_account_id AS referrer, r.invitee_account_id AS invitee,
                EXISTS (SELECT 1 FROM app.role_assignment g WHERE g.account_id = r.referrer_account_id AND g.side = 'care') AS referrer_cares,
                (SELECT count(*)::int FROM app.booking b WHERE b.booker_account_id = r.invitee_account_id AND b.status = 'completed') AS completed
           FROM app.booking bk JOIN app.referral r ON r.invitee_account_id = bk.booker_account_id
          WHERE bk.id = $1 AND r.status = 'joined' AND r.kind = 'patient' FOR UPDATE OF r`,
        [bookingId],
      );
      const referral = rows[0];
      if (referral?.completed !== 1) return [];
      if (!referral.referrer_cares) {
        await client.query(
          `UPDATE app.referral SET status = 'rejected', flag_reason = 'provider_referrer' WHERE id = $1`,
          [referral.id],
        );
        return [];
      }
      await client.query(
        `UPDATE app.referral SET status = 'rewarded', rewarded_at = now() WHERE id = $1`,
        [referral.id],
      );
      await this.issue(
        client,
        referral.referrer,
        await this.settings.get('referral_reward_paise'),
        'referral',
        referral.id,
      );
      await this.issue(
        client,
        referral.invitee,
        await this.settings.get('referral_invitee_reward_paise'),
        'referral_welcome',
        referral.id,
      );
      return [referral.referrer, referral.invitee];
    });
    for (const accountId of issued) await this.notifier.notify(accountId, 'coupon_issued');
  }

  /**
   * After a booking completes: an invited provider who is approved and has completed enough
   * bookings earns their referrer commission back on later bookings (RR-04).
   */
  async qualifyProvider(bookingId: string): Promise<void> {
    const needed = await this.settings.get('provider_referral_bookings');
    const credits = await this.settings.get('provider_referral_rebate_bookings');
    const referrer = await withTransaction(this.pool, async (client) => {
      const { rows } = await client.query<{ id: string; referrer: string }>(
        `SELECT r.id, r.referrer_account_id AS referrer
           FROM app.booking bk JOIN app.referral r ON r.invitee_account_id = bk.provider_account_id
          WHERE bk.id = $1 AND r.status = 'joined' AND r.kind = 'provider'
            AND EXISTS (SELECT 1 FROM app.role_assignment g WHERE g.account_id = r.invitee_account_id
                          AND g.side = 'provider' AND g.application_status = 'approved')
            AND (SELECT count(*) FROM app.booking b WHERE b.provider_account_id = r.invitee_account_id
                   AND b.status = 'completed') >= $2
          FOR UPDATE OF r`,
        [bookingId, needed],
      );
      const referral = rows[0];
      if (!referral) return undefined;
      await client.query(
        `UPDATE app.referral SET status = 'rewarded', rewarded_at = now() WHERE id = $1`,
        [referral.id],
      );
      await client.query(
        `INSERT INTO app.commission_credit (account_id, bookings_left) VALUES ($1, $2)
         ON CONFLICT (account_id) DO UPDATE SET bookings_left = app.commission_credit.bookings_left + EXCLUDED.bookings_left, updated_at = now()`,
        [referral.referrer, credits],
      );
      await this.audit.record(
        { action: 'referral.provider_rewarded', entity: 'referral', entityId: referral.id },
        client,
      );
      return referral.referrer;
    });
    if (referrer) await this.notifier.notify(referrer, 'commission_credit_issued');
  }

  /** A provider with credit gets part of this booking's commission back in their earnings (RR-04). */
  async rebate(bookingId: string): Promise<void> {
    const percent = await this.settings.get('provider_referral_rebate_percent');
    await withTransaction(this.pool, async (client) => {
      const { rows } = await client.query<{ provider: string; commission: number }>(
        `SELECT bk.provider_account_id AS provider, bk.commission_paise AS commission
           FROM app.booking bk JOIN app.commission_credit c ON c.account_id = bk.provider_account_id
          WHERE bk.id = $1 AND bk.status = 'completed' AND c.bookings_left > 0
          FOR UPDATE OF c`,
        [bookingId],
      );
      const due = rows[0];
      const amountPaise = due ? Math.round((due.commission * percent) / 100) : 0;
      if (!due || amountPaise <= 0) return;
      const credited = await this.ledger.earn(client, {
        providerId: due.provider,
        bookingId,
        amountPaise,
        kind: 'commission_rebate',
        at: new Date(),
      });
      if (credited)
        await client.query(
          'UPDATE app.commission_credit SET bookings_left = bookings_left - 1, updated_at = now() WHERE account_id = $1',
          [due.provider],
        );
    });
  }

  async queue(status?: string): Promise<Plain<AdminReferralDto>[]> {
    const { rows } = await this.pool.query<Plain<AdminReferralDto>>(
      `SELECT id, status, flag_reason AS "flagReason", created_at AS "createdAt" FROM app.referral
        WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at DESC LIMIT 200`,
      [status ?? null],
    );
    return rows;
  }

  /** Review of a held referral (AD-16): release it to earn later, or reject it. */
  async review(id: string, decision: 'release' | 'reject'): Promise<void> {
    const result = await this.pool.query(
      `UPDATE app.referral SET status = $2, flag_reason = CASE WHEN $2 = 'rejected' THEN 'admin_review' ELSE NULL END
        WHERE id = $1 AND status = 'flagged'`,
      [id, decision === 'release' ? 'joined' : 'rejected'],
    );
    if (result.rowCount !== 1) throw new NotFoundException();
    await this.audit.record({ action: `referral.${decision}`, entity: 'referral', entityId: id });
  }

  async cancelCoupon(id: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE app.coupon SET status = 'cancelled' WHERE id = $1 AND status = 'active'`,
      [id],
    );
    if (result.rowCount !== 1) throw new NotFoundException();
    await this.audit.record({ action: 'coupon.cancelled', entity: 'coupon', entityId: id });
  }

  private async issue(
    client: TransactionClient,
    accountId: string,
    valuePaise: number,
    source: string,
    referralId: string,
  ): Promise<void> {
    if (valuePaise < 100) return;
    const days = await this.settings.get('coupon_validity_days');
    await client.query(
      `INSERT INTO app.coupon (id, account_id, value_paise, expires_at, source, referral_id) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        accountId,
        valuePaise,
        new Date(Date.now() + days * DAY_MS),
        source,
        referralId,
      ],
    );
  }

  private async codeOf(accountId: string): Promise<string> {
    const existing = await this.pool.query<{ code: string }>(
      'SELECT code FROM app.referral_code WHERE account_id = $1',
      [accountId],
    );
    if (existing.rows[0]) return existing.rows[0].code;
    for (;;) {
      const code = newReferralCode();
      const inserted = await this.pool.query<{ code: string }>(
        `INSERT INTO app.referral_code (account_id, code) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING code`,
        [accountId, code],
      );
      if (inserted.rows[0]) return inserted.rows[0].code;
      const raced = await this.pool.query<{ code: string }>(
        'SELECT code FROM app.referral_code WHERE account_id = $1',
        [accountId],
      );
      if (raced.rows[0]) return raced.rows[0].code;
    }
  }
}
