import { formatDateTime } from '@heach/i18n';
import { Button, EmptyState, ErrorState, Skeleton, Table } from '@heach/ui';
import { useState } from 'react';
import { errorText, t } from '../i18n';
import { usePending } from '../use-pending';
import { AuditExport } from './AuditExport';
import { AuditFilters } from './AuditFilters';
import { type AuditEntry, NO_FILTERS, useAuditEntries } from './audit-query';

const columns = [
  {
    key: 'at',
    header: t('audit.time'),
    cell: (row: AuditEntry) => formatDateTime(new Date(row.at), 'en'),
  },
  { key: 'actorId', header: t('audit.actorId'), cell: (row: AuditEntry) => row.actorId ?? '—' },
  { key: 'actorRole', header: t('audit.actorRole'), cell: (row: AuditEntry) => row.actorRole },
  { key: 'action', header: t('audit.action'), cell: (row: AuditEntry) => row.action },
  { key: 'entity', header: t('audit.entity'), cell: (row: AuditEntry) => row.entity },
  { key: 'entityId', header: t('audit.entityId'), cell: (row: AuditEntry) => row.entityId ?? '—' },
  {
    key: 'correlationId',
    header: t('audit.correlationId'),
    cell: (row: AuditEntry) => row.correlationId,
  },
];

/** The audit log (AD-11), for super admins: search, page through and export. */
export function AuditLog() {
  const [filters, setFilters] = useState(NO_FILTERS);
  const { entries, loadMore } = useAuditEntries(filters);
  const { pending, error, run } = usePending();
  return (
    <>
      <h1>{t('audit.title')}</h1>
      <p>{t('audit.intro')}</p>
      <AuditFilters onSearch={setFilters} />
      <AuditExport filters={filters} />
      {entries.state === 'loading' && <Skeleton label={t('state.loading')} />}
      {entries.state === 'error' && (
        <ErrorState
          message={errorText(entries.error)}
          retryLabel={t('state.retry')}
          onRetry={() => {
            setFilters({ ...filters });
          }}
        />
      )}
      {entries.state === 'ready' && entries.entries.length === 0 && (
        <EmptyState message={t('audit.none')} />
      )}
      {entries.state === 'ready' && entries.entries.length > 0 && (
        <Table
          caption={t('audit.caption')}
          columns={columns}
          rows={entries.entries}
          rowKey={(row) => row.seq}
        />
      )}
      {entries.state === 'ready' && entries.nextBefore !== null && (
        <Button
          className="heach-button--secondary"
          disabled={pending}
          onClick={() => void run(loadMore)}
        >
          {t('audit.loadMore')}
        </Button>
      )}
      {error !== undefined && <ErrorState message={errorText(error)} />}
    </>
  );
}
