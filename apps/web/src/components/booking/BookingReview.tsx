'use client';

import { Button, Card, Notice } from '@heach/ui';
import type { Booking, BookingPolicy } from '@heach/types';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { money } from './money';

/**
 * The fee breakdown and cancellation policy, shown before payment (BK-04, PY-01). Payment goes
 * through the gateway's hosted checkout (PY-07); until it exists, the sandbox stands in for it.
 */
export function BookingReview({ booking }: Readonly<{ booking: Booking }>) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const policy = useResource<BookingPolicy>('/booking-policy');
  const { pending, error, run } = usePending();
  const checkout = booking.checkout;
  const fees = booking.fees;
  const pay = () =>
    run(async () => {
      if (!checkout) return;
      await api(`/payments/sandbox/${checkout.orderId}/pay`, { method: 'POST' });
      router.push(`/${locale}/bookings/${booking.id}?paid=1`);
    });
  return (
    <Card title={t('book.reviewTitle')}>
      <p>{booking.itemName}</p>
      <dl className="facts">
        <dt>{t('book.fee')}</dt>
        <dd>{money(fees.feePaise)}</dd>
        {fees.travelPaise > 0 && (
          <>
            <dt>{t('book.travel')}</dt>
            <dd>{money(fees.travelPaise)}</dd>
          </>
        )}
        <dt>{t('book.total')}</dt>
        <dd>{money(fees.totalPaise)}</dd>
      </dl>
      {fees.advancePaise < fees.totalPaise && (
        <p>
          {t('book.advanceNote', {
            advance: money(fees.advancePaise),
            balance: money(fees.totalPaise - fees.advancePaise),
          })}
        </p>
      )}
      {policy.resource.state === 'ready' && (
        <p className="flow__muted">
          {t('book.policy', {
            hours: policy.resource.data.freeCancellationHours,
            percent: policy.resource.data.lateRefundPercent,
          })}
        </p>
      )}
      {checkout?.sandbox && <Notice tone="info">{t('book.sandbox')}</Notice>}
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      {checkout && (
        <Button onClick={() => void pay()} disabled={pending}>
          {t('book.pay', { amount: money(checkout.amountPaise) })}
        </Button>
      )}
    </Card>
  );
}
