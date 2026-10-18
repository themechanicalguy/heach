/** Sends transactional SMS (OTP, reminders). Text never contains Restricted data (EN, NT). */
export interface SmsSender {
  send(message: {
    to: string;
    templateId: string;
    params: Readonly<Record<string, string>>;
  }): Promise<{ id: string }>;
}
export const SMS_SENDER = Symbol('SMS_SENDER');
