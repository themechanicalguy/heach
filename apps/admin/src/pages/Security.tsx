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
      </dl>
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
