'use client';

import { formatMonthYear } from '@heach/i18n';
import { EmptyState } from '@heach/ui';
import type { VaultRecord } from '@heach/types';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { RecordRow } from './RecordRow';

/**
 * Records A at every width (G10, G11): month groups of scannable rows, newest first. Record
 * actions keep the existing access checks; the server decides what may be opened or deleted.
 */
export function VaultTimeline({
  records,
  onRefresh,
  onShare,
}: Readonly<{
  records: readonly VaultRecord[];
  onRefresh: () => Promise<void>;
  onShare: (recordId: string) => void;
}>) {
  const { locale, t } = useI18n();
  if (!records.length) return <EmptyState message={t('vault.empty')} />;
  const months = [...new Set(records.map((record) => record.recordDate.slice(0, 7)))].sort((a, b) =>
    b.localeCompare(a),
  );
  return (
    <div className="vault-timeline">
      {months.map((month) => (
        <section key={month} className="vault-timeline__month">
          <h2 className="vault-timeline__title">
            {formatMonthYear(new Date(`${month}-15T12:00:00+05:30`), locale)}
          </h2>
          <ul className="vault-timeline__list">
            {records
              .filter((record) => record.recordDate.startsWith(month))
              .sort((a, b) => b.recordDate.localeCompare(a.recordDate))
              .map((record) => (
                <li key={record.id}>
                  <RecordRow
                    record={record}
                    showAccess
                    onShare={() => {
                      onShare(record.id);
                    }}
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
