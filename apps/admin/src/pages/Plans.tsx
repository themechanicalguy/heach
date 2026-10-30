import { formatPaise } from '@heach/i18n';
import { Button, EmptyState, ErrorState, Notice, Skeleton, Table } from '@heach/ui';
import type { Plan } from '@heach/types';
import { useCallback } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import { usePending } from '../use-pending';
import { label } from './labels';
import { PlanForm } from './PlanForm';
import { PlanPurchases } from './PlanPurchases';

/** Plans (PK-01, PK-02, AD-14): approve provider plans, retire old ones, create platform plans. */
export function Plans({ canChange }: Readonly<{ canChange: boolean }>) {
  const { loaded, reload } = useLoad(useCallback(() => api<Plan[]>('/plans'), []));
  const { pending, error, run } = usePending();
  const act = (id: string, verb: 'approve' | 'retire') =>
    run(async () => {
      await api(`/plans/${id}/${verb}`, { method: 'POST' });
      reload();
    });
  const button = (row: Plan, verb: 'approve' | 'retire') => {
    const text = t(`plans.${verb}`);
    return (
      <Button
        className={verb === 'retire' ? 'heach-button--danger' : undefined}
        aria-label={`${text} ${row.name}`}
        disabled={pending}
        onClick={() => void act(row.id, verb)}
      >
        {text}
      </Button>
    );
  };
  return (
    <>
      <h1>{t('plans.title')}</h1>
      <p>{t('plans.intro')}</p>
      {error !== undefined && <Notice tone="danger">{errorText(error)}</Notice>}
      {loaded.state === 'loading' && <Skeleton label={t('state.loading')} />}
      {loaded.state === 'error' && (
        <ErrorState
          message={errorText(loaded.error)}
          retryLabel={t('state.retry')}
          onRetry={reload}
        />
      )}
      {loaded.state === 'ready' && loaded.value.length === 0 && (
        <EmptyState message={t('plans.empty')} />
      )}
      {loaded.state === 'ready' && loaded.value.length > 0 && (
        <Table
          caption={t('plans.caption')}
          rows={loaded.value}
          rowKey={(row) => row.id}
          columns={[
            { key: 'name', header: t('plans.name'), cell: (row: Plan) => row.name },
            {
              key: 'by',
              header: t('plans.by'),
              cell: (row: Plan) => row.providerName ?? t('plans.platform'),
            },
            {
              key: 'covers',
              header: t('plans.covers'),
              cell: (row: Plan) => row.itemCode ?? row.service ?? '—',
            },
            {
              key: 'units',
              header: t('plans.unitsHeader'),
              cell: (row: Plan) => String(row.units),
            },
            {
              key: 'price',
              header: t('plans.price'),
              cell: (row: Plan) => formatPaise(row.pricePaise),
            },
            {
              key: 'status',
              header: t('plans.status'),
              cell: (row: Plan) => label('plans.statuses', row.status),
            },
            {
              key: 'actions',
              header: '',
              cell: (row: Plan) => {
                if (!canChange || row.status === 'retired') return null;
                return row.status === 'pending_approval'
                  ? button(row, 'approve')
                  : button(row, 'retire');
              },
            },
          ]}
        />
      )}
      <PlanPurchases />
      {canChange && <PlanForm onCreated={reload} />}
    </>
  );
}
