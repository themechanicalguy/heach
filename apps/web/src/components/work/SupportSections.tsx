'use client';

import { formatDateTime } from '@heach/i18n';
import type { AccessEntry, Ticket } from '@heach/types';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { useResource } from '../../lib/use-resource';

/** The account's own tickets with their status (RF-03). */
export function TicketsSection() {
  const { locale, t } = useI18n();
  const { resource } = useResource<Ticket[]>('/tickets');
  if (resource.state !== 'ready') return null;
  return (
    <section aria-labelledby="tickets-title">
      <h2 id="tickets-title" className="flow__subtitle">
        {t('tickets.title')}
      </h2>
      {resource.data.length === 0 ? (
        <p className="flow__muted">{t('tickets.empty')}</p>
      ) : (
        <ul>
          {resource.data.map((ticket) => (
            <li key={ticket.id}>
              {t(keyFor('safety.topics', ticket.topic, 'tickets.title'))} ·{' '}
              {t(keyFor('tickets.status', ticket.status, 'tickets.title'))} ·{' '}
              {formatDateTime(new Date(ticket.createdAt), locale)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Every break-glass look at the account's private details (SE-06). */
export function AccessSection() {
  const { locale, t } = useI18n();
  const { resource } = useResource<AccessEntry[]>('/me/access-history');
  if (resource.state !== 'ready') return null;
  return (
    <section aria-labelledby="access-title">
      <h2 id="access-title" className="flow__subtitle">
        {t('access.title')}
      </h2>
      <p className="flow__muted">{t('access.intro')}</p>
      {resource.data.length === 0 ? (
        <p>{t('access.empty')}</p>
      ) : (
        <ul>
          {resource.data.map((entry) => (
            <li key={entry.grantedAt}>
              {t('access.entry', {
                role: entry.adminRole,
                time: formatDateTime(new Date(entry.grantedAt), locale),
                reason: entry.reason,
              })}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
