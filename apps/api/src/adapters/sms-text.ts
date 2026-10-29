import { createTranslator, messagesFor } from '@heach/i18n';
import type { SmsMessage } from './sms.port.js';

/** The text of an SMS in the recipient's language, from the shared catalogue (NT-03). */
export function smsText(message: SmsMessage): string {
  const t = createTranslator(messagesFor(message.locale), message.locale);
  return t(`sms.${message.templateId}`, message.params);
}
