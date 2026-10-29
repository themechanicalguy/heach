import { Button, EmptyState, ErrorState, Skeleton, Table, TextField } from '@heach/ui';
import type { UserPage, UserSummary } from '@heach/types';
import { useCallback, useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import { roleLabel } from './role-label';
import { UserPanel } from './UserPanel';

const roleList = (user: UserSummary) =>
  user.roles.map((grant) => roleLabel(grant)).join(', ') || t('users.noRole');

/** Masked columns (AD-01); `onOpen` shows one user's details. */
function userColumns(onOpen: (id: string) => void) {
  return [
    { key: 'name', header: t('users.name'), cell: (u: UserSummary) => u.name ?? '—' },
    { key: 'mobile', header: t('users.mobile'), cell: (u: UserSummary) => u.mobile ?? '—' },
    { key: 'roles', header: t('users.roles'), cell: roleList },
    {
      key: 'status',
      header: t('users.status'),
      cell: (u: UserSummary) =>
        u.status === 'active' ? t('users.statusActive') : t('users.statusSuspended'),
    },
    {
      key: 'setup',
      header: t('users.setup'),
      cell: (u: UserSummary) => (u.setupComplete ? t('users.setupDone') : t('users.setupOpen')),
    },
    {
      key: 'open',
      header: t('users.open'),
      cell: (u: UserSummary) => (
        <Button
          className="heach-button--secondary"
          aria-label={`${t('users.open')} ${u.name ?? ''}`}
          onClick={() => {
            onOpen(u.id);
          }}
        >
          {t('users.open')}
        </Button>
      ),
    },
  ];
}

/** User management (AD-03): masked list with search, status filter and server-side pages. */
export function Users({ canChange }: Readonly<{ canChange: boolean }>) {
  const [query, setQuery] = useState({ q: '', status: '', page: 1 });
  const [selected, setSelected] = useState<string | undefined>();
  const fetcher = useCallback(() => {
    const params = new URLSearchParams({ page: String(query.page) });
    if (query.q) params.set('q', query.q);
    if (query.status) params.set('status', query.status);
    return api<UserPage>(`/users?${params.toString()}`);
  }, [query]);
  const { loaded: load, reload } = useLoad(fetcher);

  const columns = userColumns(setSelected);

  return (
    <>
      <h1>{t('users.title')}</h1>
      <p>{t('users.intro')}</p>
      <UserFilters
        status={query.status}
        onSearch={(q) => {
          setQuery({ ...query, q, page: 1 });
        }}
        onStatus={(status) => {
          setQuery({ ...query, status, page: 1 });
        }}
      />
      <div className="admin-split">
        <div className="admin-split__main">
          {load.state === 'loading' && <Skeleton label={t('state.loading')} />}
          {load.state === 'error' && (
            <ErrorState
              message={errorText(load.error)}
              retryLabel={t('state.retry')}
              onRetry={reload}
            />
          )}
          {load.state === 'ready' && load.value.items.length === 0 && (
            <EmptyState message={t('users.empty')} />
          )}
          {load.state === 'ready' && load.value.items.length > 0 && (
            <>
              <Table
                caption={t('users.caption')}
                columns={columns}
                rows={load.value.items}
                rowKey={(u) => u.id}
              />
              <Pager
                page={load.value}
                onPage={(page) => {
                  setQuery({ ...query, page });
                }}
              />
            </>
          )}
        </div>
        {selected && (
          <UserPanel
            id={selected}
            canChange={canChange}
            onChanged={reload}
            onClose={() => {
              setSelected(undefined);
            }}
          />
        )}
      </div>
    </>
  );
}

function Pager({ page, onPage }: Readonly<{ page: UserPage; onPage: (page: number) => void }>) {
  const pages = Math.max(1, Math.ceil(page.total / page.pageSize));
  return (
    <nav className="admin-actions" aria-label={t('users.page', { page: page.page, pages })}>
      <Button
        className="heach-button--secondary"
        disabled={page.page <= 1}
        onClick={() => {
          onPage(page.page - 1);
        }}
      >
        {t('users.previous')}
      </Button>
      <span>{t('users.page', { page: page.page, pages })}</span>
      <Button
        className="heach-button--secondary"
        disabled={page.page >= pages}
        onClick={() => {
          onPage(page.page + 1);
        }}
      >
        {t('users.next')}
      </Button>
    </nav>
  );
}

interface FilterProps {
  status: string;
  onSearch: (q: string) => void;
  onStatus: (status: string) => void;
}

function UserFilters({ status, onSearch, onStatus }: Readonly<FilterProps>) {
  const [draft, setDraft] = useState('');
  const search = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    onSearch(draft.trim());
  };
  return (
    <form className="admin-filters" onSubmit={search}>
      <TextField
        label={t('users.search')}
        type="search"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
      />
      <label className="admin-select">
        <span>{t('users.status')}</span>
        <select
          value={status}
          onChange={(event) => {
            onStatus(event.target.value);
          }}
        >
          <option value="">{t('users.statusAll')}</option>
          <option value="active">{t('users.statusActive')}</option>
          <option value="suspended">{t('users.statusSuspended')}</option>
        </select>
      </label>
      <Button type="submit">{t('users.searchButton')}</Button>
    </form>
  );
}
