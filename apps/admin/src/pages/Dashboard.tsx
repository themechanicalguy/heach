import { formatPaise } from '@heach/i18n';
import { Button, ErrorState, Skeleton, Table } from '@heach/ui';
import type { AdminDashboard } from '@heach/types';
import { useCallback } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';

type Count = AdminDashboard['bookingsByStatus'][number];
const percent = (rate: number) => `${String(Math.round(rate * 100))}%`;

/** The admin dashboard (AD-10): counts and rates only, never personal data. */
export function Dashboard() {
  const { loaded, reload } = useLoad(useCallback(() => api<AdminDashboard>('/dashboard'), []));
  return (
    <>
      <h1>{t('dashboard.title')}</h1>
      <p>{t('dashboard.intro')}</p>
      <Button className="heach-button--secondary" onClick={reload}>
        {t('dashboard.refresh')}
      </Button>
      {loaded.state === 'loading' && <Skeleton label={t('state.loading')} />}
      {loaded.state === 'error' && (
        <ErrorState
          message={errorText(loaded.error)}
          retryLabel={t('state.retry')}
          onRetry={reload}
        />
      )}
      {loaded.state === 'ready' && <Totals data={loaded.value} />}
    </>
  );
}

function Totals({ data }: Readonly<{ data: AdminDashboard }>) {
  return (
    <>
      <dl className="admin-facts">
        <dt>{t('dashboard.signUps')}</dt>
        <dd>{String(data.signUps)}</dd>
        <dt>{t('dashboard.completion')}</dt>
        <dd>{percent(data.completionRate)}</dd>
        <dt>{t('dashboard.cancellation')}</dt>
        <dd>{percent(data.cancellationRate)}</dd>
        <dt>{t('dashboard.revenue')}</dt>
        <dd>{formatPaise(data.revenuePaise)}</dd>
      </dl>
      <Counts caption={t('dashboard.byRole')} rows={data.providersByRole} />
      <Counts caption={t('dashboard.byDistrict')} rows={data.providersByDistrict} />
      <Counts caption={t('dashboard.byService')} rows={data.bookingsByService} />
      <Counts caption={t('dashboard.byStatus')} rows={data.bookingsByStatus} />
    </>
  );
}

function Counts({ caption, rows }: Readonly<{ caption: string; rows: readonly Count[] }>) {
  return (
    <Table
      caption={caption}
      rows={rows}
      rowKey={(row) => row.label}
      columns={[
        { key: 'label', header: t('dashboard.label'), cell: (row: Count) => row.label },
        { key: 'count', header: t('dashboard.count'), cell: (row: Count) => String(row.count) },
      ]}
    />
  );
}
