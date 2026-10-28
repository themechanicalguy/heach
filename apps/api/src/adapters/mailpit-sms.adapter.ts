import type { SmsMessage, SmsSender } from './sms.port.js';
import { smsText } from './sms-text.js';

/**
 * Local development only (decision L-8): each SMS becomes an email in the Mailpit inbox, through
 * Mailpit's send API, so the OTP can be read at http://localhost:8025. Nothing leaves the machine.
 * This is a developer tool, not an SMS integration.
 */
export class MailpitSmsSender implements SmsSender {
  constructor(
    private readonly apiUrl: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async send(message: SmsMessage): Promise<{ id: string }> {
    const response = await this.fetchFn(`${this.apiUrl}/api/v1/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        From: { Email: 'sms@heach.local', Name: 'HEACH SMS' },
        To: [{ Email: `${message.to.replace(/\D/g, '')}@sms.heach.local` }],
        Subject: `SMS ${message.templateId}`,
        Text: smsText(message),
      }),
    });
    if (!response.ok) {
      throw new Error(`Mailpit answered ${String(response.status)}`);
    }
    return { id: ((await response.json()) as { ID: string }).ID };
  }
}
