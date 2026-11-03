import { LOCALES } from '@heach/i18n';
import { ApiError } from './api';
import { errorMessageKey } from './errors';
import { shellMessages } from './client-messages';
import { registerMessages } from './message-keys';

const REASONS = [
  'plan_not_renewable',
  'application_not_in_review',
  'checklist_item_fixed',
  'not_an_organisation_owner',
  'lab_named_at_setup',
  'account_missing',
  'template_invalid',
  'template_placeholders',
  'status_unchanged',
  'self_change_refused',
  'password_reused',
  'last_super_admin',
  'email_in_use',
  'admin_suspended',
];

it.each(LOCALES)('resolves all requested domain errors in the %s shell', (locale) => {
  registerMessages(shellMessages(locale));
  for (const reason of REASONS) {
    expect(errorMessageKey(new ApiError(409, reason))).toBe(`errors.${reason}`);
  }
  expect(errorMessageKey(new ApiError(409, 'unknown_reason'))).toBe('errors.generic');
});
