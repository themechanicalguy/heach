import type { MessageKey, Messages } from '@heach/i18n';
import { ApiError } from './api';

const KNOWN = new Set([
  'mobile_invalid',
  'otp_incorrect',
  'otp_expired',
  'otp_rate_limited',
  'sms_unavailable',
  'account_suspended',
  'setup_incomplete',
  'consent_outdated',
  'setup_complete',
  'role_not_granted',
  'reverification_required',
  'side_taken',
  'details_missing',
  'no_mobile',
]);

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
