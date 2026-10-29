import { Notice } from '@heach/ui';
import { t } from '../i18n';

export const ADMIN_ROLES = ['super_admin', 'verifier', 'support', 'finance'] as const;

/** A temporary password, shown once only; it is never stored in the browser (O-2). */
export function TemporaryPassword({ value }: Readonly<{ value: string }>) {
  return (
    <Notice tone="warning" live>
      {t('admins.temporaryShown')} <code className="admin-secret">{value}</code>
    </Notice>
  );
}
