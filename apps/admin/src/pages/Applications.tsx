import { EmptyState, ErrorState, Skeleton } from '@heach/ui';
import type { ApplicationSummary } from '@heach/types';
import { useCallback, useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import { ApplicationPanel } from './ApplicationPanel';
import { DocumentReview } from './DocumentReview';
import { QueueToolbar, type QueueFilters } from './QueueToolbar';
import { IdentityBadge, roleName, StatusBadge, WaitingBadge } from './status-badges';

function QueueTable({
  rows,
  selected,
  onOpen,
}: Readonly<{
  rows: readonly ApplicationSummary[];
  selected: string | undefined;
  onOpen: (id: string) => void;
}>) {
  return (
    <div className="heach-table-wrap">
      <table className="heach-table admin-queue">
        <caption className="heach-visually-hidden">{t('verification.title')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('verification.name')}</th>
            <th scope="col">{t('verification.role')}</th>
            <th scope="col">{t('verification.waiting')}</th>
            <th scope="col">{t('verification.identity')}</th>
            <th scope="col">{t('verification.status')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.accountId} data-selected={row.accountId === selected || undefined}>
              <td>
                <button
                  type="button"
                  className="admin-queue__open"
                  aria-label={`${t('verification.open')} ${row.fullName ?? ''}`}
                  onClick={() => {
                    onOpen(row.accountId);
                  }}
                >
                  {row.fullName ?? '—'}
                </button>
              </td>
              <td>{roleName(row.role)}</td>
              <td>
                <WaitingBadge submittedAt={row.submittedAt} />
              </td>
              <td>
                <IdentityBadge identity={row.identity} />
              </td>
              <td>
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The verification queue (AD-02, J5, G17): a compact toolbar and table beside the review. */
export function Applications() {
  const [filters, setFilters] = useState<QueueFilters>({ view: 'open', role: '', q: '' });
  const [selected, setSelected] = useState<string | undefined>();
  const [reviewing, setReviewing] = useState<{ accountId: string; documentId?: string }>();
  const fetcher = useCallback(
    () =>
      api<ApplicationSummary[]>('/applications/search', {
        method: 'POST',
        body: JSON.stringify({
          view: filters.view,
          ...(filters.role ? { role: filters.role } : {}),
          ...(filters.q ? { q: filters.q } : {}),
        }),
      }),
    [filters],
  );
  const { loaded, reload } = useLoad(fetcher);
  if (reviewing)
    return (
      <DocumentReview
        accountId={reviewing.accountId}
        documentId={reviewing.documentId}
        onDecided={reload}
        onBack={() => {
          setReviewing(undefined);
        }}
      />
    );
  return (
    <>
      <header className="admin-page-head">
        <div>
          <h1>{t('verification.title')}</h1>
          {loaded.state === 'ready' && (
            <p className="admin-muted">{t('verification.count', { count: loaded.value.length })}</p>
          )}
          <p className="admin-muted">{t('verification.intro')}</p>
        </div>
        <QueueToolbar filters={filters} onChange={setFilters} />
      </header>
      <div className="admin-split">
        <div className="admin-split__main">
          {loaded.state === 'loading' && <Skeleton label={t('state.loading')} />}
          {loaded.state === 'error' && (
            <ErrorState
              message={errorText(loaded.error)}
              retryLabel={t('state.retry')}
              onRetry={reload}
            />
          )}
          {loaded.state === 'ready' && loaded.value.length === 0 && (
            <EmptyState message={t('verification.empty')} />
          )}
          {loaded.state === 'ready' && loaded.value.length > 0 && (
            <QueueTable rows={loaded.value} selected={selected} onOpen={setSelected} />
          )}
        </div>
        {selected && (
          <ApplicationPanel
            key={selected}
            accountId={selected}
            onDecided={reload}
            onReview={(documentId) => {
              setReviewing({ accountId: selected, ...(documentId ? { documentId } : {}) });
            }}
            onClose={() => {
              setSelected(undefined);
            }}
          />
        )}
      </div>
    </>
  );
}
