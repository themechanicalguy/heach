import { type MessageKey, type Messages, messagesFor } from '@heach/i18n';
import { ApiError } from './api';

// Every reason code the catalogue has a message for; the API only sends stable codes.
const KNOWN = new Set(Object.keys(messagesFor('en').errors));

/**
 * The message for a failed call: the API's reason code when it has one, "no connection" when the
 * request never reached it, else a generic message. Never the response body itself.
 */
export function errorMessageKey(error: unknown): MessageKey<Messages> {
  if (error instanceof ApiError) {
    if (error.code && KNOWN.has(error.code)) return `errors.${error.code}` as MessageKey<Messages>;
    if (error.status === 429) return 'errors.otp_rate_limited';
    return 'errors.generic';
  }
  return error instanceof TypeError ? 'errors.network' : 'errors.generic';
}
