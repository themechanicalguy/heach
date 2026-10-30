import { Global, Inject, Injectable, Module } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';

export const SETTING_KEYS = [
  'acceptance_window_minutes',
  'commission_bps',
  'attendant_advance_percent',
  'free_cancellation_hours',
  'late_cancellation_refund_percent',
  'dispatch_wave_size',
  'dispatch_wave_minutes',
  'payout_hold_hours',
  'patient_no_show_fee_percent',
  'no_show_wait_minutes',
  'vault_quota_mb',
  'referral_reward_paise',
  'referral_invitee_reward_paise',
  'coupon_validity_days',
  'referral_monthly_cap',
  'referral_join_window_days',
  'plan_expiry_reminder_days',
  'renewal_notice_hours',
  'renewal_retry_hours',
  'renewal_max_attempts',
  'provider_referral_bookings',
  'provider_referral_rebate_percent',
  'provider_referral_rebate_bookings',
  'slot_hold_minutes',
  'referral_qualifying_bookings',
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

/** Operations settings (AD-08) read from the database, so they change without a deploy. */
@Injectable()
export class Settings {
  constructor(@Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>) {}

  async get(key: SettingKey): Promise<number> {
    const { rows } = await this.pool.query<{ value: number }>(
      'SELECT value FROM app.setting WHERE key = $1',
      [key],
    );
    const value = rows[0]?.value;
    if (value === undefined) throw new Error(`Setting ${key} missing`);
    return value;
  }

  async all(): Promise<Record<string, number>> {
    const { rows } = await this.pool.query<{ key: string; value: number }>(
      'SELECT key, value FROM app.setting',
    );
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async set(
    key: SettingKey,
    value: number,
    client: Pick<pg.Pool, 'query'> = this.pool,
  ): Promise<void> {
    await client.query('UPDATE app.setting SET value = $2, updated_at = now() WHERE key = $1', [
      key,
      value,
    ]);
  }
}

@Global()
@Module({ providers: [Settings], exports: [Settings] })
export class SettingsModule {}
