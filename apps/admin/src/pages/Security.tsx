import { formatDateTime } from '@heach/i18n';
import { EmptyState, ErrorState, Skeleton, Table } from '@heach/ui';
import type { SecurityConsole } from '@heach/types';
import { useCallback } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';

type Grant = SecurityConsole['breakGlass'][number];
const when = (value: string) => formatDateTime(new Date(value), 'en');

/** The security console (AD-17): what needs a security look, without personal data. */
export function Security() {
  const { loaded, reload } = useLoad(useCallback(() => api<SecurityConsole>('/security'), []));
  if (loaded.state === 'loading') return <Skeleton label={t('state.loading')} />;
  if (loaded.state === 'error')
    return (
      <ErrorState
        message={errorText(loaded.error)}
        retryLabel={t('state.retry')}
        onRetry={reload}
      />
    );
  const data = loaded.value;
  return (
    <>
      <h1>{t('security.title')}</h1>
      <p>{t('security.intro')}</p>
      <dl className="admin-facts">
        <dt>{t('security.strikes')}</dt>
        <dd>{String(data.openStrikeReviews)}</dd>
        <dt>{t('security.referrals')}</dt>
        <dd>{String(data.flaggedReferrals)}</dd>
        <dt>{t('security.infected')}</dt>
        <dd>{String(data.infectedUploads)}</dd>
        <dt>{t('security.authz')}</dt>
        <dd>{String(data.authzFailuresToday)}</dd>
        <dt>{t('security.unusual')}</dt>
        <dd>{String(data.unusualReadersToday)}</dd>
        <dt>{t('security.reads')}</dt>
        <dd>{String(data.recordReads24h)}</dd>
      </dl>
      <AccessReview admins={data.adminAccess} />
      <h2>{t('security.breakGlass')}</h2>
      {data.breakGlass.length === 0 ? (
        <EmptyState message={t('security.none')} />
      ) : (
        <Table
          caption={t('security.breakGlass')}
          rows={data.breakGlass}
          rowKey={(row) => `${row.adminRole}-${row.grantedAt}`}
          columns={[
            { key: 'role', header: t('security.role'), cell: (row: Grant) => row.adminRole },
            { key: 'reason', header: t('security.reason'), cell: (row: Grant) => row.reason },
            {
              key: 'granted',
              header: t('security.granted'),
              cell: (row: Grant) => when(row.grantedAt),
            },
            {
              key: 'expires',
              header: t('security.expires'),
              cell: (row: Grant) => when(row.expiresAt),
            },
          ]}
        />
      )}
    </>
  );
}

type Admin = SecurityConsole['adminAccess'][number];

/** The admin access review (AD-17): who has access, and who has not used it for 90 days. */
function AccessReview({ admins }: Readonly<{ admins: readonly Admin[] }>) {
  return (
    <>
      <h2>{t('security.accessReview')}</h2>
      <Table
        caption={t('security.accessReview')}
        rows={admins}
        rowKey={(row) => row.email}
        columns={[
          { key: 'email', header: t('security.email'), cell: (row: Admin) => row.email },
          {
            key: 'role',
            header: t('security.adminRoleCol'),
            cell: (row: Admin) => t(`adminRoles.${row.role as 'super_admin'}`),
          },
          { key: 'status', header: t('security.status'), cell: (row: Admin) => row.status },
          {
            key: 'last',
            header: t('security.lastSignIn'),
            cell: (row: Admin) => (row.lastSignInAt ? when(row.lastSignInAt) : t('security.never')),
          },
          {
            key: 'review',
            header: '',
            cell: (row: Admin) => t(row.stale ? 'security.stale' : 'security.ok'),
          },
        ]}
      />
    </>
  );
}
