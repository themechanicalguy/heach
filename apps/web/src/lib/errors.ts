import type { MessageKey, Messages } from '@heach/i18n';
import { ApiError } from './api';
import { hasMessage } from './message-keys';

/**
 * The message for a failed call: the API's reason code when it has one, "no connection" when the
 * request never reached it, else a generic message. Never the response body itself.
 */
export function errorMessageKey(error: unknown): MessageKey<Messages> {
  if (error instanceof ApiError) {
    // Every reason code the catalogue has a message for; the API only sends stable codes.
    if (error.code && hasMessage(`errors.${error.code}`))
      return `errors.${error.code}` as MessageKey<Messages>;
    if (error.status === 429) return 'errors.otp_rate_limited';
    return 'errors.generic';
  }
  return error instanceof TypeError ? 'errors.network' : 'errors.generic';
}
