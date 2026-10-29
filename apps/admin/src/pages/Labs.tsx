import { EmptyState, ErrorState, Skeleton, Table } from '@heach/ui';
import type { AdminLab } from '@heach/types';
import { useCallback } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';

/** Lab management (AD-13): orders, turnaround against the promise, corrections per lab. */
export function Labs() {
  const { loaded, reload } = useLoad(useCallback(() => api<AdminLab[]>('/labs'), []));
  if (loaded.state === 'loading') return <Skeleton label={t('state.loading')} />;
  if (loaded.state === 'error')
    return (
      <ErrorState
        message={errorText(loaded.error)}
        retryLabel={t('state.retry')}
        onRetry={reload}
      />
    );
  return (
    <>
      <h1>{t('labs.title')}</h1>
      <p>{t('labs.intro')}</p>
      {loaded.value.length === 0 ? (
        <EmptyState message={t('labs.empty')} />
      ) : (
        <Table
          caption={t('labs.caption')}
          rows={loaded.value}
          rowKey={(row) => row.labId}
          columns={[
            { key: 'name', header: t('labs.name'), cell: (row: AdminLab) => row.name },
            {
              key: 'orders',
              header: t('labs.orders'),
              cell: (row: AdminLab) => String(row.orders),
            },
            {
              key: 'today',
              header: t('labs.today'),
              cell: (row: AdminLab) => String(row.todayCollections),
            },
            {
              key: 'pending',
              header: t('labs.pending'),
              cell: (row: AdminLab) => String(row.pendingReports),
            },
            {
              key: 'turnaround',
              header: t('labs.turnaround'),
              cell: (row: AdminLab) =>
                row.averageTurnaroundHours === null ? '—' : String(row.averageTurnaroundHours),
            },
            {
              key: 'late',
              header: t('labs.late'),
              cell: (row: AdminLab) => String(row.lateReports),
            },
            {
              key: 'corrections',
              header: t('labs.corrections'),
              cell: (row: AdminLab) => String(row.corrections),
            },
          ]}
        />
      )}
    </>
  );
}
