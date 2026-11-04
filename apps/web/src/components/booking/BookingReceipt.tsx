'use client';

import { formatDateTime } from '@heach/i18n';
import { Icon } from '@heach/ui';
import type { BookingPolicy } from '@heach/types';
import type { ReactNode } from 'react';
import { useI18n } from '../../lib/i18n-context';
import { useResource } from '../../lib/use-resource';
import { money } from './money';

interface Props {
  /** The chosen provider; "any available provider" when matching picks one (A10). */
  providerName?: string | undefined;
  itemName: string;
  startsAt: string;
  /** The listing's fee, or the any-provider quote (an upper bound); never a computed total. */
  feePaise?: number | undefined;
  upTo?: boolean;
  children?: ReactNode;
}

/** The cancellation policy as the server states it (BK-04); nothing until it has loaded. */
export function PolicyNote() {
  const { t } = useI18n();
  const policy = useResource<BookingPolicy>('/booking-policy');
  if (policy.resource.state !== 'ready') return null;
  const { freeCancellationHours, lateRefundPercent } = policy.resource.data;
  // Never a policy with holes in it: say nothing until the server's numbers are there.
  if (!Number.isFinite(freeCancellationHours) || !Number.isFinite(lateRefundPercent)) return null;
  return (
    <p className="receipt__note">
      {t('book.policy', { hours: freeCancellationHours, percent: lateRefundPercent })}
    </p>
  );
}

/**
 * The booking receipt beside the form (G09, desktop booking board): provider, the chosen time,
 * the listed fee and the policy. Totals, travel and discounts come only from the server at the
 * payment review (BookingReview), so this receipt never adds anything up.
 */
export function BookingReceipt({
  providerName,
  itemName,
  startsAt,
  feePaise,
  upTo = false,
  children,
}: Readonly<Props>) {
  const { locale, t } = useI18n();
  return (
    <aside className="receipt" aria-labelledby="receipt-title">
      <h2 id="receipt-title" className="receipt__title">
        {t('site.bookingSummary')}
      </h2>
      <div className="receipt__who">
        <span className="receipt__avatar">
          <Icon name="user" size={20} />
        </span>
        <span>
          <strong>{providerName ?? t('book.anyTitle')}</strong>
          <span>{itemName}</span>
        </span>
      </div>
      <p className="receipt__when" data-empty={!startsAt || undefined}>
        {startsAt ? formatDateTime(new Date(startsAt), locale) : t('book.selectTime')}
      </p>
      {feePaise !== undefined && (
        <dl className="receipt__lines">
          <div>
            <dt>{t('book.fee')}</dt>
            <dd>{upTo ? t('book.anyFeeLine', { fee: money(feePaise) }) : money(feePaise)}</dd>
          </div>
        </dl>
      )}
      <p className="receipt__note">{t('book.totalNext')}</p>
      {children}
      <PolicyNote />
    </aside>
  );
}
