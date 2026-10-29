import { formatDateTime, formatPaise } from '@heach/i18n';
import { Button, EmptyState, ErrorState, Skeleton, Table } from '@heach/ui';
import type { BookingSummary } from '@heach/types';
import { useCallback, useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import { BookingPanel } from './BookingPanel';
import { label } from './labels';
import en from '../../messages/en.json';

const STATUSES = Object.keys(en.bookings.statuses);

function columns(onOpen: (id: string) => void) {
  return [
    { key: 'service', header: t('bookings.service'), cell: (b: BookingSummary) => b.itemName },
    {
      key: 'starts',
      header: t('bookings.starts'),
      cell: (b: BookingSummary) => formatDateTime(new Date(b.startsAt), 'en'),
    },
    {
      key: 'provider',
      header: t('bookings.provider'),
      cell: (b: BookingSummary) => b.provider?.name ?? '—',
    },
    { key: 'patient', header: t('bookings.patient'), cell: (b: BookingSummary) => b.recipientName },
    {
      key: 'status',
      header: t('bookings.status'),
      cell: (b: BookingSummary) => label('bookings.statuses', b.status),
    },
    {
      key: 'total',
      header: t('bookings.total'),
      cell: (b: BookingSummary) => formatPaise(b.fees.totalPaise),
    },
    {
      key: 'open',
      header: '',
      cell: (b: BookingSummary) => (
        <Button
          className="heach-button--secondary"
          aria-label={`${t('bookings.open')} ${b.id}`}
          onClick={() => {
            onOpen(b.id);
          }}
        >
          {t('bookings.open')}
        </Button>
      ),
    },
  ];
}

/** The bookings console (AD-05): filter by status, open one to cancel, refund or reassign. */
export function Bookings({ role }: Readonly<{ role: string }>) {
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string | undefined>();
  const fetcher = useCallback(
    () => api<BookingSummary[]>(status ? `/bookings?status=${status}` : '/bookings'),
    [status],
  );
  const { loaded, reload } = useLoad(fetcher);
  return (
    <>
      <h1>{t('bookings.title')}</h1>
      <p>{t('bookings.intro')}</p>
      <label className="heach-field">
        <span className="heach-field__label">{t('bookings.filter')}</span>
        <select
          className="heach-input"
          value={status}
          onChange={(event) => {
            setStatus(event.currentTarget.value);
          }}
        >
          <option value="">{t('bookings.all')}</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {label('bookings.statuses', value)}
            </option>
          ))}
        </select>
      </label>
      <div className="admin-split">
        <div className="admin-split__main">
          {loaded.state === 'loading' && <Skeleton label={t('state.loading')} />}
          {loaded.state === 'error' && (
            <ErrorState
              message={errorText(loaded.error)}
              retryLabel={t('state.retry')}
              onRetry={reload}
            />
          )}
          {loaded.state === 'ready' && loaded.value.length === 0 && (
            <EmptyState message={t('bookings.none')} />
          )}
          {loaded.state === 'ready' && loaded.value.length > 0 && (
            <Table
              caption={t('bookings.caption')}
              columns={columns(setSelected)}
              rows={loaded.value}
              rowKey={(b) => b.id}
            />
          )}
        </div>
        {selected && (
          <BookingPanel
            key={selected}
            bookingId={selected}
            role={role}
            onChanged={reload}
            onClose={() => {
              setSelected(undefined);
            }}
          />
        )}
      </div>
    </>
  );
}
