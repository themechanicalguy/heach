'use client';

import { formatDateTime } from '@heach/i18n';
import { Button, Icon, Notice } from '@heach/ui';
import type { Booking } from '@heach/types';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { money } from './money';
import { PolicyNote } from './BookingReceipt';

interface Props {
  booking: Booking;
  providerName?: string | undefined;
  startsAt: string;
}

/**
 * The fee breakdown and cancellation policy, shown before payment (BK-04, PY-01), as the final
 * receipt (G09): every amount comes from the booking the server created. Payment goes through the
 * gateway's hosted checkout (PY-07); until it exists, the sandbox stands in for it.
 */
export function BookingReview({ booking, providerName, startsAt }: Readonly<Props>) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const review = useRef<HTMLDivElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    review.current?.focus({ preventScroll: true });
  }, [booking.id]);
  const { pending, error, run } = usePending();
  const checkout = booking.checkout;
  const pay = () =>
    run(async () => {
      if (!checkout) return;
      await api(`/payments/sandbox/${checkout.orderId}/pay`, { method: 'POST' });
      router.push(`/${locale}/bookings/${booking.id}?paid=1`);
    });
  return (
    <div
      ref={review}
      tabIndex={-1}
      role="region"
      aria-label={t('book.reviewTitle')}
      className="booking-review"
    >
      <div className="receipt receipt--final">
        <h2 className="receipt__title">{t('book.reviewTitle')}</h2>
        <div className="receipt__who">
          <span className="receipt__avatar">
            <Icon name="user" size={20} />
          </span>
          <span>
            <strong>{providerName ?? t('book.anyTitle')}</strong>
            <span>{booking.itemName}</span>
          </span>
        </div>
        <p className="receipt__when">{formatDateTime(new Date(startsAt), locale)}</p>
        <FeeLines fees={booking.fees} />
        <PolicyNote />
        {checkout?.sandbox && <Notice tone="info">{t('book.sandbox')}</Notice>}
        {error && (
          <Notice tone="danger" live>
            {t(error)}
          </Notice>
        )}
        {checkout && (
          <div className="flow__actions receipt__action">
            <Button className="flow__primary" onClick={() => void pay()} disabled={pending}>
              {t('book.pay', { amount: money(checkout.amountPaise) })}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Fee, travel, discount and total exactly as the server froze them on the booking (BK-04). */
function FeeLines({ fees }: Readonly<{ fees: Booking['fees'] }>) {
  const { t } = useI18n();
  return (
    <>
      <dl className="receipt__lines">
        <div>
          <dt>{t('book.fee')}</dt>
          <dd>{money(fees.feePaise)}</dd>
        </div>
        {fees.travelPaise > 0 && (
          <div>
            <dt>{t('book.travel')}</dt>
            <dd>{money(fees.travelPaise)}</dd>
          </div>
        )}
        {fees.discountPaise > 0 && (
          <div className="receipt__discount">
            <dt>{t('book.discount')}</dt>
            <dd>−{money(fees.discountPaise)}</dd>
          </div>
        )}
        <div className="receipt__total">
          <dt>{t('book.total')}</dt>
          <dd>{money(fees.totalPaise)}</dd>
        </div>
      </dl>
      {fees.advancePaise < fees.totalPaise && (
        <p className="receipt__note">
          {t('book.advanceNote', {
            advance: money(fees.advancePaise),
            balance: money(fees.totalPaise - fees.advancePaise),
          })}
        </p>
      )}
    </>
  );
}
