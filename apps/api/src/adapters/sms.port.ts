import type { Locale } from '@heach/i18n';

/** Templates registered with the SMS provider (DLT in India); text is in the i18n catalogue. */
export type SmsTemplate =
  | 'otp_sign_in'
  | 'otp_reverify'
  | 'otp_change_mobile'
  | 'application_approved'
  | 'application_rejected'
  | 'application_changes_requested';

export interface SmsMessage {
  to: string;
  /** The recipient's language; every template exists in Odia, English and Hindi (NT-03). */
  locale: Locale;
  templateId: SmsTemplate;
  params: Readonly<Record<string, string>>;
}

/** Sends transactional SMS (OTP, reminders). Text never contains Restricted data (EN, NT). */
export interface SmsSender {
  send(message: SmsMessage): Promise<{ id: string }>;
}
export const SMS_SENDER = Symbol('SMS_SENDER');
