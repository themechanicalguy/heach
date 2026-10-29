import { Button, ChoiceGroup, EmptyState, ErrorState, Skeleton, Table } from '@heach/ui';
import type { ApplicationSummary } from '@heach/types';
import { useCallback, useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import { ApplicationPanel } from './ApplicationPanel';
import { label } from './labels';

function columns(onOpen: (id: string) => void) {
  return [
    {
      key: 'name',
      header: t('verification.name'),
      cell: (a: ApplicationSummary) => a.fullName ?? '—',
    },
    { key: 'role', header: t('verification.role'), cell: (a: ApplicationSummary) => a.role },
    {
      key: 'status',
      header: t('verification.status'),
      cell: (a: ApplicationSummary) => label('verification.statuses', a.status),
    },
    {
      key: 'submitted',
      header: t('verification.submitted'),
      cell: (a: ApplicationSummary) =>
        a.submittedAt ? new Date(a.submittedAt).toLocaleDateString('en-IN') : '—',
    },
    {
      key: 'open',
      header: t('verification.open'),
      cell: (a: ApplicationSummary) => (
        <Button
          className="heach-button--secondary"
          aria-label={`${t('verification.open')} ${a.fullName ?? ''}`}
          onClick={() => {
            onOpen(a.accountId);
          }}
        >
          {t('verification.open')}
        </Button>
      ),
    },
  ];
}

/** The verification queue (AD-02, J5): waiting applications oldest first, or decided ones. */
export function Applications() {
  const [view, setView] = useState<'open' | 'decided'>('open');
  const [selected, setSelected] = useState<string | undefined>();
  const fetcher = useCallback(
    () => api<ApplicationSummary[]>(`/applications?view=${view}`),
    [view],
  );
  const { loaded, reload } = useLoad(fetcher);
  return (
    <>
      <h1>{t('verification.title')}</h1>
      <p>{t('verification.intro')}</p>
      <ChoiceGroup
        legend={t('verification.status')}
        name="application-view"
        value={view}
        choices={[
          { value: 'open', label: t('verification.viewOpen') },
          { value: 'decided', label: t('verification.viewDecided') },
        ]}
        onChange={(value) => {
          setView(value === 'decided' ? 'decided' : 'open');
        }}
      />
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
            <Table
              caption={t('verification.title')}
              columns={columns(setSelected)}
              rows={loaded.value}
              rowKey={(a) => a.accountId}
            />
          )}
        </div>
        {selected && (
          <ApplicationPanel
            key={selected}
            accountId={selected}
            onDecided={reload}
            onClose={() => {
              setSelected(undefined);
            }}
          />
        )}
      </div>
    </>
  );
}
