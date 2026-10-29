'use client';

import { formatDateTime } from '@heach/i18n';
import { Button, EmptyState } from '@heach/ui';
import type { AppNotification } from '@heach/types';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';
import { AccessSection, TicketsSection } from './SupportSections';

/** The in-app notification centre (NT-02): the same words as the SMS, in the reader's language. */
export function NotificationsView() {
  const { locale, t } = useI18n();
  const { resource, reload } = useResource<AppNotification[]>('/me/notifications');
  const text = (note: AppNotification) => {
    const params = Object.fromEntries(
      Object.entries(note.params).map(([key, value]) => [
        key,
        key === 'time' ? formatDateTime(new Date(value), locale) : value,
      ]),
    );
    return t(keyFor('sms', note.template, 'notifications.title'), params);
  };
  return (
    <section className="flow" aria-labelledby="notifications-title">
      <div className="flow__card">
        <h1 id="notifications-title" className="flow__title">
          {t('notifications.title')}
        </h1>
        <ResourceView resource={resource} reload={reload}>
          {(notes) =>
            notes.length === 0 ? (
              <EmptyState message={t('notifications.empty')} />
            ) : (
              <>
                <ul className="role-list">
                  {notes.map((note) => (
                    <li key={note.id} data-unread={note.readAt === null}>
                      <p>{text(note)}</p>
                      <p className="flow__muted">
                        {formatDateTime(new Date(note.createdAt), locale)}
                      </p>
                    </li>
                  ))}
                </ul>
                <Button
                  className="heach-button--secondary"
                  onClick={() =>
                    void api('/me/notifications/read', { method: 'POST' }).then(reload)
                  }
                >
                  {t('notifications.markRead')}
                </Button>
              </>
            )
          }
        </ResourceView>
        <TicketsSection />
        <AccessSection />
      </div>
    </section>
  );
}
