import { formatDateTime, formatPaise } from '@heach/i18n';
import { Button, ErrorState, Notice, Skeleton, Table } from '@heach/ui';
import type { Finance as FinanceData, PayoutRun } from '@heach/types';
import { useCallback, useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import { usePending } from '../use-pending';

/** Finance (AD-07): totals, commission rate, payout runs, and a CSV export without Restricted data. */
export function Finance() {
  const { loaded, reload } = useLoad(useCallback(() => api<FinanceData>('/finance'), []));
  const [notice, setNotice] = useState<string | undefined>();
  const { pending, error, run } = usePending();
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
  const runNow = () =>
    run(async () => {
      const result = await api<PayoutRun>('/finance/payout-runs', { method: 'POST' });
      setNotice(t('finance.ran', { count: result.providerCount }));
      reload();
    });
  return (
    <>
      <h1>{t('finance.title')}</h1>
      <p>{t('finance.intro')}</p>
      <dl className="admin-facts">
        <dt>{t('finance.paid')}</dt>
        <dd>{formatPaise(data.paidPaise)}</dd>
        <dt>{t('finance.refunded')}</dt>
        <dd>{formatPaise(data.refundedPaise)}</dd>
        <dt>{t('finance.commission')}</dt>
        <dd>{formatPaise(data.commissionPaise)}</dd>
      </dl>
      <p>{t('finance.rate', { percent: data.commissionBps / 100 })}</p>
      {notice && (
        <Notice tone="success" live>
          {notice}
        </Notice>
      )}
      {error !== undefined && <Notice tone="danger">{errorText(error)}</Notice>}
      <div className="admin-actions">
        <Button onClick={() => void runNow()} disabled={pending}>
          {t('finance.runNow')}
        </Button>
        <a
          className="heach-button heach-button--secondary"
          href="/api/admin/v1/finance/export.csv"
          download
        >
          {t('finance.export')}
        </a>
      </div>
      <h2>{t('finance.runs')}</h2>
      <Table
        caption={t('finance.runCaption')}
        rows={data.runs}
        rowKey={(row) => row.id}
        columns={[
          {
            key: 'at',
            header: t('finance.runAt'),
            cell: (row: PayoutRun) => formatDateTime(new Date(row.runAt), 'en'),
          },
          {
            key: 'providers',
            header: t('finance.providers'),
            cell: (row: PayoutRun) => String(row.providerCount),
          },
          {
            key: 'amount',
            header: t('finance.amount'),
            cell: (row: PayoutRun) => formatPaise(row.totalPaise),
          },
        ]}
      />
    </>
  );
}
