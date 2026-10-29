import { Button, Notice } from '@heach/ui';
import type { AdminSummary, TemporaryPassword as Temporary } from '@heach/types';
import { useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { usePending } from '../use-pending';
import { useReverified } from '../use-reverified';
import { ADMIN_ROLES, TemporaryPassword } from './TemporaryPassword';

/** Changes to another admin's account; every one needs a fresh TOTP and signs them out (O-2). */
export function AdminActions({
  admin,
  onChanged,
}: Readonly<{ admin: AdminSummary; onChanged: () => Promise<void> }>) {
  const [role, setRole] = useState<string>(admin.role);
  const [temporary, setTemporary] = useState<string | undefined>();
  const [done, setDone] = useState<string | undefined>();
  const { pending, error, run } = usePending();
  const { attempt, sheet } = useReverified(run);
  const act = (path: string, init: RequestInit, message: string) =>
    attempt(async () => {
      const result = await api<Temporary | undefined>(`/admins/${admin.id}/${path}`, init);
      if (result?.temporaryPassword) setTemporary(result.temporaryPassword);
      setDone(message);
      await onChanged();
    });
  const put = (body: object): RequestInit => ({ method: 'PUT', body: JSON.stringify(body) });
  const enable = admin.status === 'disabled';

  return (
    <div className="admin-form">
      <label className="admin-select">
        <span>{t('admins.role')}</span>
        <select
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
          }}
        >
          {ADMIN_ROLES.map((each) => (
            <option key={each} value={each}>
              {t(`adminRoles.${each}`)}
            </option>
          ))}
        </select>
      </label>
      <Button
        disabled={pending || role === admin.role}
        onClick={() => void act('role', put({ role }), t('admins.roleChanged'))}
      >
        {t('admins.changeRole')}
      </Button>
      <Button
        className={enable ? undefined : 'heach-button--danger'}
        disabled={pending}
        onClick={() =>
          void act(
            'status',
            put({ status: enable ? 'active' : 'disabled' }),
            t(enable ? 'admins.enabled' : 'admins.disabledDone'),
          )
        }
      >
        {t(enable ? 'admins.enable' : 'admins.disable')}
      </Button>
      <Button
        className="heach-button--ghost"
        disabled={pending}
        onClick={() => void act('password-reset', { method: 'POST' }, t('admins.passwordReset'))}
      >
        {t('admins.resetPassword')}
      </Button>
      <Button
        className="heach-button--ghost"
        disabled={pending}
        onClick={() => void act('mfa-reset', { method: 'POST' }, t('admins.mfaReset'))}
      >
        {t('admins.resetMfa')}
      </Button>
      {temporary && <TemporaryPassword value={temporary} />}
      {done && (
        <Notice tone="success" live>
          {done}
        </Notice>
      )}
      {error !== undefined && (
        <Notice tone="danger" live>
          {errorText(error)}
        </Notice>
      )}
      {sheet}
    </div>
  );
}
