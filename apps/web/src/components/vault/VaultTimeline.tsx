'use client';

import { useSyncExternalStore } from 'react';
import { formatDate } from '@heach/i18n';
import { EmptyState, Table, media } from '@heach/ui';
import type { VaultRecord } from '@heach/types';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { RecordActions } from './RecordActions';
import { RecordCard, RecordDetails, RecordIssuer } from './RecordCard';

/** Records A: chronological groups. Record actions retain the existing access checks. */
export function VaultTimeline({
  records,
  onRefresh,
}: Readonly<{
  records: readonly VaultRecord[];
  onRefresh: () => Promise<void>;
}>) {
  const { locale, t } = useI18n();
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    () => typeof window.matchMedia === 'function' && window.matchMedia(media.desktop).matches,
    () => false,
  );
  const months = [...new Set(records.map((record) => record.recordDate.slice(0, 7)))].sort((a, b) =>
    b.localeCompare(a),
  );
  if (!records.length) return <EmptyState message={t('vault.empty')} />;
  if (desktop) return <DesktopRecords records={records} onRefresh={onRefresh} />;
  return (
    <div className="vault-timeline">
      {months.map((month) => (
        <section key={month}>
          <h2>
            {new Intl.DateTimeFormat(`${locale}-IN`, {
              month: 'long',
              year: 'numeric',
              timeZone: 'Asia/Kolkata',
            }).format(new Date(`${month}-01T00:00:00+05:30`))}
          </h2>
          <ul className="role-list">
            {records
              .filter((record) => record.recordDate.startsWith(month))
              .sort((a, b) => b.recordDate.localeCompare(a.recordDate))
              .map((record) => (
                <li key={record.id}>
                  <RecordCard
                    record={record}
                    showAccess
                    onDelete={async () => {
                      await api(`/vault/records/${record.id}`, { method: 'DELETE' });
                      await onRefresh();
                    }}
                  />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function subscribeDesktop(changed: () => void) {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia(media.desktop);
  query.addEventListener('change', changed);
  return () => {
    query.removeEventListener('change', changed);
  };
}

function DesktopRecords({
  records,
  onRefresh,
}: Readonly<{ records: readonly VaultRecord[]; onRefresh: () => Promise<void> }>) {
  const { locale, t } = useI18n();
  return (
    <Table
      caption={t('vault.title')}
      rows={Array.from(records).sort((a, b) => b.recordDate.localeCompare(a.recordDate))}
      rowKey={(record) => record.id}
      columns={[
        {
          key: 'record',
          header: t('vault.recordTitle'),
          cell: (record) => (
            <div className="vault-record-details">
              <strong>{record.title}</strong>
              <RecordIssuer record={record} />
              <details>
                <summary>{t('site.details')}</summary>
                <RecordDetails record={record} hideIssuer />
              </details>
            </div>
          ),
        },
        {
          key: 'from',
          header: t('vault.facility'),
          cell: (record) => record.issuedBy ?? record.facility ?? t('vault.addedByYou'),
        },
        {
          key: 'date',
          header: t('vault.recordDate'),
          cell: (record) => formatDate(new Date(`${record.recordDate}T00:00:00+05:30`), locale),
        },
        {
          key: 'actions',
          header: t('site.details'),
          cell: (record) => (
            <RecordActions
              record={record}
              showAccess
              onDelete={async () => {
                await api(`/vault/records/${record.id}`, { method: 'DELETE' });
                await onRefresh();
              }}
            />
          ),
        },
      ]}
    />
  );
}
