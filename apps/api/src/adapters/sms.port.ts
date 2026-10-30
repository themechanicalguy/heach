import type { Locale } from '@heach/i18n';

/** Templates registered with the SMS provider (DLT in India); text is in the i18n catalogue. */
export type SmsTemplate =
  | 'otp_sign_in'
  | 'otp_reverify'
  | 'otp_change_mobile'
  | 'application_approved'
  | 'application_rejected'
  | 'application_changes_requested'
  | 'booking_request'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_reminder'
  | 'booking_balance_due'
  | 'visit_started'
  | 'visit_completed'
  | 'lab_report_ready'
  | 'lab_collector_assigned'
  | 'lab_sample_collected'
  | 'lab_sample_received'
  | 'plan_expiring'
  | 'coupon_issued'
  | 'plan_renewal_notice'
  | 'plan_renewed'
  | 'plan_renewal_failed'
  | 'plan_renewal_paused'
  | 'commission_credit_issued'
  | 'plan_units_low'
  | 'security_notice';

export interface SmsMessage {
  to: string;
  /** The recipient's language; every template exists in Odia, English and Hindi (NT-03). */
  locale: Locale;
  templateId: SmsTemplate;
  params: Readonly<Record<string, string>>;
  /** An admin-edited wording of the template in this language (AD-09), used instead of the catalogue. */
  text?: string;
}

/** Sends transactional SMS (OTP, reminders). Text never contains Restricted data (EN, NT). */
export interface SmsSender {
  send(message: SmsMessage): Promise<{ id: string }>;
}
export const SMS_SENDER = Symbol('SMS_SENDER');
