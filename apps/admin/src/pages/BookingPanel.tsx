import { formatDateTime, formatPaise } from '@heach/i18n';
import { Button, ErrorState, Notice, Skeleton, TextField } from '@heach/ui';
import type { BookingSummary } from '@heach/types';
import { useCallback, useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import { usePending } from '../use-pending';
import { label } from './labels';
import en from '../../messages/en.json';

type AdminBooking = BookingSummary & {
  events: { toStatus: string; reason: string | null; actorRole: string; createdAt: string }[];
  refunds: { amountPaise: number; reason: string; status: string }[];
  payments: { purpose: string; amountPaise: number; status: string }[];
};

interface Props {
  bookingId: string;
  role: string;
  onChanged: () => void;
  onClose: () => void;
}

const SUPPORT = new Set(['super_admin', 'support']);
const FINANCE = new Set(['super_admin', 'finance']);

/** One booking for support and finance (AD-05, PY-02): timeline, payments, actions by sub-role. */
export function BookingPanel({ bookingId, role, onChanged, onClose }: Readonly<Props>) {
  const fetcher = useCallback(() => api<AdminBooking>(`/bookings/${bookingId}`), [bookingId]);
  const { loaded, reload } = useLoad(fetcher);
  const [notice, setNotice] = useState<string | undefined>();
  const { pending, error, run } = usePending();
  const act = (path: string, body: object, done: string) =>
    run(async () => {
      await api(`/bookings/${bookingId}/${path}`, { method: 'POST', body: JSON.stringify(body) });
      setNotice(done);
      reload();
      onChanged();
    });
  if (loaded.state === 'error')
    return (
      <ErrorState
        message={errorText(loaded.error)}
        retryLabel={t('state.retry')}
        onRetry={reload}
      />
    );
  if (loaded.state === 'loading') return <Skeleton label={t('state.loading')} />;
  const booking = loaded.value;
  return (
    <aside className="admin-panel" aria-label={t('bookings.detailTitle')}>
      <h2>{booking.itemName}</h2>
      <dl className="admin-facts">
        <dt>{t('bookings.status')}</dt>
        <dd>{label('bookings.statuses', booking.status)}</dd>
        <dt>{t('bookings.paid')}</dt>
        <dd>{formatPaise(booking.fees.paidPaise)}</dd>
      </dl>
      <h3>{t('bookings.timeline')}</h3>
      <ol className="admin-list">
        {booking.events.map((event) => (
          <li key={`${event.createdAt}-${event.toStatus}`}>
            {`${formatDateTime(new Date(event.createdAt), 'en')}: ${label('bookings.statuses', event.toStatus)} (${event.actorRole}) ${event.reason ?? ''}`}
          </li>
        ))}
      </ol>
      <h3>{t('bookings.payments')}</h3>
      <ul className="admin-list">
        {booking.payments.map((payment) => (
          <li
            key={payment.purpose}
          >{`${payment.purpose}: ${formatPaise(payment.amountPaise)} ${payment.status}`}</li>
        ))}
        {booking.refunds.map((refund, index) => (
          <li
            key={`refund-${String(index)}`}
          >{`${t('bookings.refunds')}: ${formatPaise(refund.amountPaise)} ${refund.reason} ${refund.status}`}</li>
        ))}
      </ul>
      {notice && (
        <Notice tone="success" live>
          {notice}
        </Notice>
      )}
      {error !== undefined && <Notice tone="danger">{errorText(error)}</Notice>}
      {SUPPORT.has(role) && <SupportActions pending={pending} act={act} />}
      {FINANCE.has(role) && <RefundForm pending={pending} act={act} />}
      <Button className="heach-button--secondary" onClick={onClose}>
        {t('bookings.close')}
      </Button>
    </aside>
  );
}

type Act = (path: string, body: object, done: string) => Promise<void>;

function SupportActions({ pending, act }: Readonly<{ pending: boolean; act: Act }>) {
  const [listingId, setListingId] = useState('');
  return (
    <div className="admin-actions">
      <Button
        className="heach-button--danger"
        disabled={pending}
        onClick={() => void act('cancel', { reason: 'admin_decision' }, t('bookings.cancelled'))}
      >
        {t('bookings.cancel')}
      </Button>
      <TextField
        label={t('bookings.reassign')}
        value={listingId}
        onChange={(event) => {
          setListingId(event.currentTarget.value.trim());
        }}
      />
      <Button
        disabled={pending || !listingId}
        onClick={() => void act('reassign', { listingId }, t('bookings.reassigned'))}
      >
        {t('bookings.doReassign')}
      </Button>
    </div>
  );
}

function RefundForm({ pending, act }: Readonly<{ pending: boolean; act: Act }>) {
  const [rupees, setRupees] = useState('');
  const [why, setWhy] = useState('goodwill');
  return (
    <div className="admin-actions">
      <TextField
        label={t('bookings.refund')}
        inputMode="decimal"
        value={rupees}
        onChange={(event) => {
          setRupees(event.currentTarget.value);
        }}
      />
      <label className="heach-field">
        <span className="heach-field__label">{t('bookings.refundReason')}</span>
        <select
          className="heach-input"
          value={why}
          onChange={(event) => {
            setWhy(event.currentTarget.value);
          }}
        >
          {Object.keys(en.bookings.reasons).map((value) => (
            <option key={value} value={value}>
              {label('bookings.reasons', value)}
            </option>
          ))}
        </select>
      </label>
      <Button
        disabled={pending || !rupees}
        onClick={() =>
          void act(
            'refund',
            { amountPaise: Math.round(Number(rupees) * 100), reason: why },
            t('bookings.refunded'),
          )
        }
      >
        {t('bookings.issueRefund')}
      </Button>
    </div>
  );
}
