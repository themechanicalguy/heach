import type { UserSummary } from '@heach/types';
import { t } from '../i18n';

type Grant = UserSummary['roles'][number];

/**
 * A user's role as admins read it: the application status where asked, and whether the role is
 * deferred beyond the MVP (ADR 0015), kept on the account but unable to act.
 */
export function roleLabel(grant: Grant, withStatus = false): string {
  const notes = [
    withStatus ? grant.applicationStatus : null,
    grant.available ? null : t('users.roleDeferred'),
  ].filter(Boolean);
  return notes.length > 0 ? `${grant.role} (${notes.join(', ')})` : grant.role;
}
