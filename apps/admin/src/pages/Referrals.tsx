import { formatDate } from '@heach/i18n';
import { Button, EmptyState, ErrorState, Notice, Skeleton, Table, TextField } from '@heach/ui';
import type { AdminReferral } from '@heach/types';
import { useCallback, useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import { usePending } from '../use-pending';
import { label } from './labels';
import { Choice } from './Tickets';
import en from '../../messages/en.json';

/** Referral review (RR-06): release or reject a flagged reward; cancel a mistaken coupon. */
export function Referrals() {
  const [status, setStatus] = useState('flagged');
  const { loaded, reload } = useLoad(
    useCallback(() => api<AdminReferral[]>(`/referrals?status=${status}`), [status]),
  );
  const { pending, error, run } = usePending();
  const act = (path: string, then: () => void) =>
    run(async () => {
      await api(path, { method: 'POST' });
      then();
    });
  return (
    <>
      <h1>{t('referrals.title')}</h1>
      <p>{t('referrals.intro')}</p>
      {error !== undefined && <Notice tone="danger">{errorText(error)}</Notice>}
      <Choice
        label={t('referrals.filter')}
        value={status}
        onChange={setStatus}
        group="referrals.statuses"
        values={Object.keys(en.referrals.statuses)}
      />
      {loaded.state === 'loading' && <Skeleton label={t('state.loading')} />}
      {loaded.state === 'error' && (
        <ErrorState
          message={errorText(loaded.error)}
          retryLabel={t('state.retry')}
          onRetry={reload}
        />
      )}
      {loaded.state === 'ready' && (
        <Queue
          rows={loaded.value}
          pending={pending}
          onAct={(id, verb) => void act(`/referrals/${id}/${verb}`, reload)}
        />
      )}
      <CancelCoupon pending={pending} onCancel={(id, done) => act(`/coupons/${id}/cancel`, done)} />
    </>
  );
}

interface QueueProps {
  rows: readonly AdminReferral[];
  pending: boolean;
  onAct: (id: string, verb: 'release' | 'reject') => void;
}

function Queue({ rows, pending, onAct }: Readonly<QueueProps>) {
  if (rows.length === 0) return <EmptyState message={t('referrals.empty')} />;
  const button = (row: AdminReferral, verb: 'release' | 'reject') => {
    const text = t(`referrals.${verb}`);
    return (
      <Button
        className={verb === 'reject' ? 'heach-button--danger' : undefined}
        aria-label={`${text} ${row.id}`}
        disabled={pending}
        onClick={() => {
          onAct(row.id, verb);
        }}
      >
        {text}
      </Button>
    );
  };
  return (
    <Table
      caption={t('referrals.caption')}
      rows={rows}
      rowKey={(row) => row.id}
      columns={[
        {
          key: 'status',
          header: t('referrals.status'),
          cell: (row: AdminReferral) => label('referrals.statuses', row.status),
        },
        {
          key: 'reason',
          header: t('referrals.reason'),
          cell: (row: AdminReferral) => row.flagReason ?? '—',
        },
        {
          key: 'created',
          header: t('referrals.created'),
          cell: (row: AdminReferral) => formatDate(new Date(row.createdAt), 'en'),
        },
        {
          key: 'actions',
          header: '',
          cell: (row: AdminReferral) =>
            row.status === 'flagged' ? (
              <>
                {button(row, 'release')} {button(row, 'reject')}
              </>
            ) : null,
        },
      ]}
    />
  );
}

interface CancelProps {
  pending: boolean;
  onCancel: (id: string, done: () => void) => Promise<void>;
}

function CancelCoupon({ pending, onCancel }: Readonly<CancelProps>) {
  const [id, setId] = useState('');
  const [done, setDone] = useState(false);
  return (
    <form
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        setDone(false);
        void onCancel(id.trim(), () => {
          setDone(true);
          setId('');
        });
      }}
    >
      <TextField
        label={t('referrals.coupon')}
        value={id}
        onChange={(event) => {
          setId(event.currentTarget.value);
        }}
      />
      <Button className="heach-button--danger" type="submit" disabled={pending || !id.trim()}>
        {t('referrals.cancelCoupon')}
      </Button>
      {done && <Notice tone="success">{t('referrals.cancelled')}</Notice>}
    </form>
  );
}
