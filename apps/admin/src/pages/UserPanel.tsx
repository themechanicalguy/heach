import { Button, ErrorState, Notice, Skeleton } from '@heach/ui';
import type { UserDetail } from '@heach/types';
import { useCallback, useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import { roleLabel } from './role-label';
import { StatusControls } from './StatusControls';

interface Props {
  id: string;
  canChange: boolean;
  onChanged: () => void;
  onClose: () => void;
}

/** One user's details (an audited read) and, for super admin and support, status changes. */
export function UserPanel({ id, canChange, onChanged, onClose }: Readonly<Props>) {
  const fetcher = useCallback(() => api<UserDetail>(`/users/${id}`), [id]);
  const { loaded, reload } = useLoad(fetcher);
  const [notice, setNotice] = useState<string | undefined>();
  if (loaded.state === 'error') {
    return (
      <ErrorState
        message={errorText(loaded.error)}
        retryLabel={t('state.retry')}
        onRetry={reload}
      />
    );
  }
  if (loaded.state === 'loading') return <Skeleton label={t('state.loading')} />;
  const user = loaded.value;
  const roles = user.roles.map((grant) => roleLabel(grant, true)).join(', ');
  return (
    <aside className="admin-panel" aria-label={t('users.detailTitle')}>
      <h2>{t('users.detailTitle')}</h2>
      <dl className="admin-facts">
        <dt>{t('users.fullName')}</dt>
        <dd>{user.fullName ?? '—'}</dd>
        <dt>{t('users.mobile')}</dt>
        <dd>{user.mobile ?? '—'}</dd>
        <dt>{t('users.roles')}</dt>
        <dd>{roles || t('users.noRole')}</dd>
        <dt>{t('users.status')}</dt>
        <dd>{user.status === 'active' ? t('users.statusActive') : t('users.statusSuspended')}</dd>
      </dl>
      {notice && (
        <Notice tone="success" live>
          {notice}
        </Notice>
      )}
      {canChange && (
        <StatusControls
          key={user.status}
          user={user}
          onChanged={(message) => {
            setNotice(message);
            reload();
            onChanged();
          }}
        />
      )}
      <Button className="heach-button--ghost" onClick={onClose}>
        {t('users.close')}
      </Button>
    </aside>
  );
}
