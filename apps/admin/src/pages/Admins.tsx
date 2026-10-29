import { Button, ErrorState, Notice, Skeleton, Table, TextField } from '@heach/ui';
import type { AdminSummary, CreatedAdmin } from '@heach/types';
import { useCallback, useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import { usePending } from '../use-pending';
import { useReverified } from '../use-reverified';
import { AdminActions } from './AdminActions';
import { ADMIN_ROLES, TemporaryPassword } from './TemporaryPassword';

/**
 * Admin accounts, for super admins only (AD-01, owner decision O-2): create one with a temporary
 * password, change a sub-role, disable or enable, reset a password or MFA. The API refuses
 * changes to one's own account and to the last super admin.
 */
export function Admins({ selfId }: Readonly<{ selfId: string | undefined }>) {
  const fetcher = useCallback(() => api<AdminSummary[]>('/admins'), []);
  const { loaded, reload } = useLoad(fetcher);
  const refresh = () => {
    reload();
    return Promise.resolve();
  };
  const columns = [
    { key: 'email', header: t('admins.email'), cell: (a: AdminSummary) => a.email },
    {
      key: 'role',
      header: t('admins.role'),
      cell: (a: AdminSummary) => t(`adminRoles.${a.role as 'super_admin'}`),
    },
    { key: 'state', header: t('admins.state'), cell: stateOf },
    {
      key: 'actions',
      header: t('admins.actions'),
      cell: (a: AdminSummary) =>
        a.id === selfId ? t('admins.you') : <AdminActions admin={a} onChanged={refresh} />,
    },
  ];

  return (
    <section aria-labelledby="admins-title" className="admin-page">
      <h1 id="admins-title">{t('admins.title')}</h1>
      <p>{t('admins.intro')}</p>
      <CreateAdmin onCreated={refresh} />
      {loaded.state === 'loading' && <Skeleton label={t('state.loading')} />}
      {loaded.state === 'error' && (
        <ErrorState
          message={errorText(loaded.error)}
          retryLabel={t('state.retry')}
          onRetry={reload}
        />
      )}
      {loaded.state === 'ready' && (
        <Table
          caption={t('admins.caption')}
          columns={columns}
          rows={loaded.value}
          rowKey={(a) => a.id}
        />
      )}
    </section>
  );
}

function stateOf(admin: AdminSummary): string {
  const parts = [t(admin.status === 'active' ? 'admins.active' : 'admins.disabled')];
  if (!admin.mfaEnrolled) parts.push(t('admins.mfaPending'));
  if (admin.mustChangePassword) parts.push(t('admins.temporary'));
  if (admin.locked) parts.push(t('admins.locked'));
  return parts.join(', ');
}

function CreateAdmin({ onCreated }: Readonly<{ onCreated: () => Promise<void> }>) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('support');
  const [created, setCreated] = useState<string | undefined>();
  const { pending, error, run } = usePending();
  const { attempt, sheet } = useReverified(run);
  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    void attempt(async () => {
      const body = JSON.stringify({ email, role });
      const result = await api<CreatedAdmin>('/admins', { method: 'POST', body });
      setCreated(result.temporaryPassword);
      setEmail('');
      await onCreated();
    });
  };
  return (
    <>
      <form className="admin-form" onSubmit={submit} aria-labelledby="create-admin-title">
        <h2 id="create-admin-title">{t('admins.createTitle')}</h2>
        <TextField
          label={t('admins.email')}
          type="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
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
        {error !== undefined && (
          <Notice tone="danger" live>
            {errorText(error)}
          </Notice>
        )}
        {created && <TemporaryPassword value={created} />}
        <Button type="submit" disabled={pending || email.trim() === ''} aria-busy={pending}>
          {t('admins.create')}
        </Button>
      </form>
      {sheet}
    </>
  );
}
