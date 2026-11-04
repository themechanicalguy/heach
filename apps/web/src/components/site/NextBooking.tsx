'use client';

import { formatDateTime } from '@heach/i18n';
import type { BookingSummary } from '@heach/types';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';

const UPCOMING = ['pending_payment', 'requested', 'confirmed', 'in_progress'];

function nextOf(rows: BookingSummary[]) {
  return rows
    .filter((row) => UPCOMING.includes(row.status) && new Date(row.endsAt).getTime() > Date.now())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
}

/**
 * The booking's main next step (G04): pay while payment is open, the start code once confirmed
 * for a home visit or shift. Otherwise the status says what HEACH is waiting for.
 */
function primaryAction(booking: BookingSummary) {
  if (booking.status === 'pending_payment') return { key: 'site.payNow', hash: '' } as const;
  if (['confirmed', 'in_progress'].includes(booking.status) && booking.kind !== 'lab_test')
    return { key: 'visit.showCode', hash: '#start-code' } as const;
  return undefined;
}

function NextBookingPanel({ booking }: Readonly<{ booking: BookingSummary }>) {
  const { locale, t } = useI18n();
  const href = `/${locale}/bookings/${booking.id}`;
  const action = primaryAction(booking);
  return (
    <section className="next-booking" aria-labelledby="next-booking-title">
      <h2 id="next-booking-title" className="next-booking__label">
        {t('site.next')}
      </h2>
      <p className="next-booking__time">{formatDateTime(new Date(booking.startsAt), locale)}</p>
      <p className="next-booking__meta">
        {booking.itemName} · {booking.provider?.name ?? t('bookings.anyProvider')}
      </p>
      {!action && (
        <p className="next-booking__status">
          {t(keyFor('bookings.status', booking.status, 'bookings.detailTitle'))}
        </p>
      )}
      <div className="next-booking__actions">
        {action && (
          <a className="heach-button heach-button--compact" href={`${href}${action.hash}`}>
            {t(action.key)}
          </a>
        )}
        <a className="heach-button heach-button--secondary heach-button--compact" href={href}>
          {t('site.details')}
        </a>
      </div>
    </section>
  );
}

/** The next upcoming booking in the home side column; nothing when there is none. */
export function NextBooking() {
  const { locale } = useI18n();
  const { resource, reload } = useResource<BookingSummary[]>(`/bookings?locale=${locale}`);
  return (
    <ResourceView resource={resource} reload={reload}>
      {(rows) => {
        const next = nextOf(rows);
        return next ? <NextBookingPanel booking={next} /> : null;
      }}
    </ResourceView>
  );
}
