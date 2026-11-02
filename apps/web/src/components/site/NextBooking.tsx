'use client';

import { formatDateTime } from '@heach/i18n';
import { Card } from '@heach/ui';
import type { BookingSummary } from '@heach/types';
import { useI18n } from '../../lib/i18n-context';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';

export function NextBooking() {
  const { locale, t } = useI18n();
  const { resource, reload } = useResource<BookingSummary[]>(`/bookings?locale=${locale}`);
  return (
    <ResourceView resource={resource} reload={reload}>
      {(rows) => {
        const next = rows
          .filter(
            (row) =>
              ['pending_payment', 'requested', 'confirmed', 'in_progress'].includes(row.status) &&
              new Date(row.endsAt).getTime() > Date.now(),
          )
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
        return next ? (
          <Card title={t('site.next')}>
            <p>
              <strong>{formatDateTime(new Date(next.startsAt), locale)}</strong>
            </p>
            <p>{next.itemName}</p>
            <p>{next.provider?.name ?? t('bookings.anyProvider')}</p>
            <a
              className="heach-button heach-button--secondary"
              href={`/${locale}/bookings/${next.id}`}
            >
              {t('site.details')}
            </a>
          </Card>
        ) : null;
      }}
    </ResourceView>
  );
}
