'use client';

import { formatDateTime } from '@heach/i18n';
import { Button, Card, EmptyState, Notice } from '@heach/ui';
import type { BookingSummary, ProviderBooking } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';
import { money } from '../booking/money';
import { ProviderVisitPanel } from '../visit/ProviderVisitPanel';

/** A provider's bookings (BK-07); opening one shows the address and contact once confirmed (HS-02). */
export function WorkView() {
  const { locale, t } = useI18n();
  const { resource, reload } = useResource<BookingSummary[]>(`/provider/bookings?locale=${locale}`);
  const [open, setOpen] = useState<string | undefined>();
  return (
    <section className="flow" aria-labelledby="work-title">
      <div className="flow__card">
        <h1 id="work-title" className="flow__title">
          {t('work.title')}
        </h1>
        <ResourceView resource={resource} reload={reload}>
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState message={t('work.empty')} />
            ) : (
              <ul className="role-list">
                {rows.map((row) => (
                  <li key={row.id}>
                    <Card title={row.itemName}>
                      <p>
                        <strong>
                          {t(keyFor('bookings.status', row.status, 'bookings.detailTitle'))}
                        </strong>{' '}
                        · {formatDateTime(new Date(row.startsAt), locale)}
                      </p>
                      <p className="flow__muted">
                        {t('bookings.for', { name: row.recipientName })}
                      </p>
                      {open === row.id ? (
                        <WorkDetail bookingId={row.id} onChanged={reload} />
                      ) : (
                        <Button
                          className="heach-button--secondary"
                          onClick={() => {
                            setOpen(row.id);
                          }}
                        >
                          {t('bookings.open')}
                        </Button>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            )
          }
        </ResourceView>
      </div>
    </section>
  );
}

function WorkDetail({
  bookingId,
  onChanged,
}: Readonly<{ bookingId: string; onChanged: () => Promise<void> }>) {
  const { locale, t } = useI18n();
  const { resource, reload } = useResource<ProviderBooking>(
    `/provider/bookings/${bookingId}?locale=${locale}`,
  );
  const { pending, error, run } = usePending();
  return (
    <ResourceView resource={resource} reload={reload}>
      {(booking) => (
        <>
          <dl className="facts">
            {booking.address && (
              <>
                <dt>{t('work.address')}</dt>
                <dd>{booking.address}</dd>
              </>
            )}
            {booking.contactMobile && (
              <>
                <dt>{t('work.contact')}</dt>
                <dd>
                  <a href={`tel:${booking.contactMobile}`}>{booking.contactMobile}</a>
                </dd>
              </>
            )}
            <dt>{t('requests.earning', { amount: '' })}</dt>
            <dd>{money(booking.earningPaise)}</dd>
          </dl>
          {booking.notes && <p>{t('requests.notes', { notes: booking.notes })}</p>}
          <ProviderVisitPanel
            booking={booking}
            onChanged={async () => {
              await reload();
              await onChanged();
            }}
          />
          {error && (
            <Notice tone="danger" live>
              {t(error)}
            </Notice>
          )}
          {booking.status === 'confirmed' && (
            <>
              <p className="flow__muted">{t('work.cancelHint')}</p>
              <Button
                className="heach-button--danger"
                disabled={pending}
                onClick={() =>
                  void run(async () => {
                    await api(`/provider/bookings/${bookingId}/cancel`, {
                      method: 'POST',
                      body: JSON.stringify({ reason: 'provider_unavailable' }),
                    });
                    await onChanged();
                  })
                }
              >
                {t('work.cancel')}
              </Button>
            </>
          )}
        </>
      )}
    </ResourceView>
  );
}
