import { ApiError } from './api';
import { errorText, t } from './i18n';

it.each([
  'plan_not_renewable',
  'not_an_organisation_owner',
  'lab_named_at_setup',
  'account_missing',
  'admin_suspended',
] as const)('resolves the domain error %s', (reason) => {
  expect(errorText(new ApiError(403, reason))).toBe(t(`errors.${reason}`));
  expect(errorText(new ApiError(403, reason))).not.toBe(t('errors.forbidden'));
});
