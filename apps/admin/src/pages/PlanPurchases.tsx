import { formatDate, formatPaise } from '@heach/i18n';
import { EmptyState, ErrorState, Skeleton, Table } from '@heach/ui';
import type { AdminPurchase } from '@heach/types';
import { useCallback } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import { label } from './labels';

const yesNo = (value: boolean) => t(value ? 'plans.yes' : 'plans.no');
const date = (value: string | null) => (value ? formatDate(new Date(value), 'en') : '—');

/** Purchases, renewals and cancellations (AD-14); never who bought them. */
export function PlanPurchases() {
  const { loaded, reload } = useLoad(
    useCallback(() => api<AdminPurchase[]>('/plans/purchases'), []),
  );
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
      <h2>{t('plans.purchases')}</h2>
      {loaded.value.length === 0 ? (
        <EmptyState message={t('plans.purchasesEmpty')} />
      ) : (
        <Table
          caption={t('plans.purchasesCaption')}
          rows={loaded.value}
          rowKey={(row) => row.id}
          columns={[
            { key: 'plan', header: t('plans.name'), cell: (row: AdminPurchase) => row.planName },
            {
              key: 'status',
              header: t('plans.status'),
              cell: (row: AdminPurchase) => label('plans.purchaseStatuses', row.status),
            },
            {
              key: 'renewal',
              header: t('plans.renewal'),
              cell: (row: AdminPurchase) => yesNo(row.renewal),
            },
            {
              key: 'renews',
              header: t('plans.renews'),
              cell: (row: AdminPurchase) =>
                row.renewalPaused ? t('plans.paused') : yesNo(row.autoRenew),
            },
            {
              key: 'paid',
              header: t('plans.paid'),
              cell: (row: AdminPurchase) => formatPaise(row.paidPaise),
            },
            {
              key: 'refunded',
              header: t('plans.refunded'),
              cell: (row: AdminPurchase) => formatPaise(row.refundedPaise),
            },
            {
              key: 'bought',
              header: t('plans.bought'),
              cell: (row: AdminPurchase) => date(row.createdAt),
            },
            {
              key: 'ends',
              header: t('plans.ends'),
              cell: (row: AdminPurchase) => date(row.endsAt),
            },
          ]}
        />
      )}
    </>
  );
}
