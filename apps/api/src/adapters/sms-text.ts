import { createTranslator, formatIcu, messagesFor } from '@heach/i18n';
import type { SmsMessage } from './sms.port.js';

/** The text of an SMS in the recipient's language, from the shared catalogue (NT-03) or its edited wording (AD-09). */
export function smsText(message: SmsMessage): string {
  if (message.text) return formatIcu(message.text, message.params, message.locale);
  const t = createTranslator(messagesFor(message.locale), message.locale);
  return t(`sms.${message.templateId}`, message.params);
}
