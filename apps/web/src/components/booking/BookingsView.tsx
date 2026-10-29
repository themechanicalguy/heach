'use client';

import { formatDateTime } from '@heach/i18n';
import { Button, Card, EmptyState, Notice, Skeleton } from '@heach/ui';
import type { Booking, BookingSummary, Checkout } from '@heach/types';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import {
  readOfflineSummary,
  saveOfflineSummary,
  type OfflineBooking,
} from '../../lib/offline-summary';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';
import { PatientVisitPanel } from '../visit/PatientVisitPanel';
import { money } from './money';

/** The patient's bookings (BK-07); the last list stays readable offline until sign-out. */
export function BookingsView() {
  const { locale, t } = useI18n();
  const { resource, reload } = useResource<BookingSummary[]>(`/bookings?locale=${locale}`);
  const [offline, setOffline] = useState<OfflineBooking[] | undefined>();
  useEffect(() => {
    if (resource.state === 'ready') {
      saveOfflineSummary(
        resource.data.map((row) => ({
          id: row.id,
          itemName: row.itemName,
          startsAt: row.startsAt,
          providerName: row.provider?.name ?? null,
          status: row.status,
        })),
      );
    }
    if (resource.state === 'error') setOffline(readOfflineSummary());
  }, [resource]);

  return (
    <section className="flow" aria-labelledby="bookings-title">
      <div className="flow__card">
        <h1 id="bookings-title" className="flow__title">
          {t('bookings.title')}
        </h1>
        {offline && offline.length > 0 ? (
          <>
            <Notice tone="warning">{t('bookings.offline')}</Notice>
            <ul className="role-list">
              {offline.map((row) => (
                <li key={row.id}>
                  <Card title={row.itemName}>
                    <p>{formatDateTime(new Date(row.startsAt), locale)}</p>
                    {row.providerName && <p>{t('bookings.with', { name: row.providerName })}</p>}
                  </Card>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <ResourceView resource={resource} reload={reload}>
            {(rows) =>
              rows.length === 0 ? (
                <EmptyState message={t('bookings.empty')} />
              ) : (
                <BookingList rows={rows} />
              )
            }
          </ResourceView>
        )}
      </div>
    </section>
  );
}

function BookingList({ rows }: Readonly<{ rows: BookingSummary[] }>) {
  const { locale, t } = useI18n();
  return (
    <ul className="role-list">
      {rows.map((row) => (
        <li key={row.id}>
          <Card title={row.itemName}>
            <p>
              <strong>{t(keyFor('bookings.status', row.status, 'bookings.detailTitle'))}</strong> ·{' '}
              {formatDateTime(new Date(row.startsAt), locale)}
            </p>
            <p className="flow__muted">
              {row.provider
                ? t('bookings.with', { name: row.provider.name })
                : t('bookings.anyProvider')}
            </p>
            <Link
              className="heach-button heach-button--secondary"
              href={`/${locale}/bookings/${row.id}`}
            >
              {t('bookings.open')}
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/** One booking: status, timeline, fees, refunds, cancel under the policy, pay what is due. */
export function BookingDetailView({ bookingId }: Readonly<{ bookingId: string }>) {
  const { locale } = useI18n();
  const { resource, reload } = useResource<Booking>(`/bookings/${bookingId}?locale=${locale}`);
  return (
    <ResourceView resource={resource} reload={reload}>
      {(booking) => <BookingDetail booking={booking} onChanged={reload} />}
    </ResourceView>
  );
}

function BookingDetail({
  booking,
  onChanged,
}: Readonly<{ booking: Booking; onChanged: () => Promise<void> }>) {
  const { locale, t } = useI18n();
  const params = useSearchParams();
  const reasonLabel = (why: string | null) =>
    why ? t(keyFor('bookings.reasons', why, 'bookings.reasons.other')) : '';
  return (
    <section className="flow" aria-labelledby="booking-title">
      <div className="flow__card">
        <h1 id="booking-title" className="flow__title">
          {booking.itemName}
        </h1>
        {params.get('paid') && booking.status !== 'pending_payment' && (
          <Notice tone="success" live>
            {t('book.paid')}
          </Notice>
        )}
        <p className="status-card__line">
          <strong>{t(keyFor('bookings.status', booking.status, 'bookings.detailTitle'))}</strong>
          {booking.statusReason && <span> · {reasonLabel(booking.statusReason)}</span>}
        </p>
        <p>{formatDateTime(new Date(booking.startsAt), locale)}</p>
        <p>
          {booking.provider
            ? t('bookings.with', { name: booking.provider.name })
            : t('bookings.anyProvider')}
        </p>
        <p className="flow__muted">{t('bookings.for', { name: booking.recipientName })}</p>
        {booking.status === 'requested' && booking.acceptBy && (
          <Notice tone="info">
            {t('bookings.acceptBy', { time: formatDateTime(new Date(booking.acceptBy), locale) })}
          </Notice>
        )}
        <dl className="facts">
          <dt>{t('bookings.address')}</dt>
          <dd>{booking.address}</dd>
          <dt>{t('book.total')}</dt>
          <dd>{money(booking.fees.totalPaise)}</dd>
        </dl>
        <p className="flow__muted">
          {t('bookings.paidLine', {
            paid: money(booking.fees.paidPaise),
            refunded: money(booking.fees.refundedPaise),
          })}
        </p>
        <Payments booking={booking} onChanged={onChanged} />
        {booking.refunds.length > 0 && (
          <>
            <h2 className="flow__subtitle">{t('bookings.refunds')}</h2>
            <ul>
              {booking.refunds.map((refund, index) => (
                <li key={`${refund.reason}-${String(index)}`}>
                  {t('bookings.refund', {
                    amount: money(refund.amountPaise),
                    status: t(keyFor('bookings.refundStatus', refund.status, 'bookings.refunds')),
                  })}
                </li>
              ))}
            </ul>
          </>
        )}
        <h2 className="flow__subtitle">{t('bookings.timeline')}</h2>
        <ol>
          {booking.events.map((event) => (
            <li key={`${event.createdAt}-${event.toStatus}`}>
              {formatDateTime(new Date(event.createdAt), locale)}:{' '}
              {t(keyFor('bookings.status', event.toStatus, 'bookings.detailTitle'))}{' '}
              {reasonLabel(event.reason)}
            </li>
          ))}
        </ol>
        <PatientVisitPanel booking={booking} onChanged={onChanged} />
        {booking.canCancel && <CancelBooking booking={booking} onChanged={onChanged} />}
      </div>
    </section>
  );
}

function Payments({
  booking,
  onChanged,
}: Readonly<{ booking: Booking; onChanged: () => Promise<void> }>) {
  const { t } = useI18n();
  const router = useRouter();
  const { pending, error, run } = usePending();
  const payOrder = async (checkout: Checkout) => {
    await api(`/payments/sandbox/${checkout.orderId}/pay`, { method: 'POST' });
    await onChanged();
  };
  const due = booking.fees.balanceDuePaise;
  const checkout = booking.checkout;
  return (
    <>
      {checkout && (
        <Button onClick={() => void run(() => payOrder(checkout))} disabled={pending}>
          {t('book.pay', { amount: money(checkout.amountPaise) })}
        </Button>
      )}
      {due > 0 && !booking.checkout && (
        <>
          <Notice tone="warning">{t('bookings.balanceDue', { amount: money(due) })}</Notice>
          <Button
            onClick={() =>
              void run(async () => {
                await payOrder(
                  await api<Checkout>(`/bookings/${booking.id}/balance`, { method: 'POST' }),
                );
                router.refresh();
              })
            }
            disabled={pending}
          >
            {t('bookings.payBalance', { amount: money(due) })}
          </Button>
        </>
      )}
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
    </>
  );
}

function CancelBooking({
  booking,
  onChanged,
}: Readonly<{ booking: Booking; onChanged: () => Promise<void> }>) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const { pending, error, run } = usePending();
  if (!confirming) {
    return (
      <Button
        className="heach-button--danger"
        onClick={() => {
          setConfirming(true);
        }}
      >
        {t('bookings.cancel')}
      </Button>
    );
  }
  return (
    <Card title={t('bookings.cancel')}>
      <p>{t('bookings.cancelRefund', { amount: money(booking.refundIfCancelledPaise) })}</p>
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      {pending && <Skeleton label={t('state.loading')} />}
      <Button
        className="heach-button--danger"
        disabled={pending}
        onClick={() =>
          void run(async () => {
            await api(`/bookings/${booking.id}/cancel`, {
              method: 'POST',
              body: JSON.stringify({ reason: 'changed_plans' }),
            });
            setConfirming(false);
            await onChanged();
          })
        }
      >
        {t('bookings.cancelConfirm')}
      </Button>
      <Button
        className="heach-button--secondary"
        onClick={() => {
          setConfirming(false);
        }}
      >
        {t('bookings.keep')}
      </Button>
    </Card>
  );
}
