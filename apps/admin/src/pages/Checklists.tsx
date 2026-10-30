import { Button, ErrorState, Notice, Skeleton, Table } from '@heach/ui';
import type { ChecklistRole } from '@heach/types';
import { useCallback } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import { usePending } from '../use-pending';
import { useReverified } from '../use-reverified';
import { label } from './labels';

type Entry = ChecklistRole['items'][number];

/** Document checklists per provider type (AD-08): super admin changes which are required. */
export function Checklists({ canChange }: Readonly<{ canChange: boolean }>) {
  const { loaded, reload } = useLoad(useCallback(() => api<ChecklistRole[]>('/checklists'), []));
  const { pending, error, run } = usePending();
  const { attempt, sheet } = useReverified(run);
  if (loaded.state === 'loading') return <Skeleton label={t('state.loading')} />;
  if (loaded.state === 'error')
    return (
      <ErrorState
        message={errorText(loaded.error)}
        retryLabel={t('state.retry')}
        onRetry={reload}
      />
    );
  const toggle = (role: string, entry: Entry) =>
    attempt(async () => {
      await api(`/checklists/${role}/${entry.key}`, {
        method: 'PUT',
        body: JSON.stringify({ required: !entry.required }),
      });
      reload();
    });
  return (
    <>
      <h2>{t('checklists.title')}</h2>
      <p>{t('checklists.intro')}</p>
      {error !== undefined && <Notice tone="danger">{errorText(error)}</Notice>}
      {loaded.value.map((row) => {
        return (
          <Table
            key={row.role}
            caption={t('checklists.caption', { role: label('checklists.roles', row.role) })}
            rows={row.items}
            rowKey={(entry) => entry.key}
            columns={[
              {
                key: 'item',
                header: t('checklists.item'),
                cell: (entry: Entry) => label('checklists.items', entry.key),
              },
              {
                key: 'required',
                header: t('checklists.required'),
                cell: (entry: Entry) => t(entry.required ? 'checklists.yes' : 'checklists.no'),
              },
              {
                key: 'change',
                header: '',
                cell: (entry: Entry) => {
                  if (entry.fixed) return <>{t('checklists.fixed')}</>;
                  if (!canChange) return null;
                  const text = t(
                    entry.required ? 'checklists.makeOptional' : 'checklists.makeRequired',
                  );
                  return (
                    <Button
                      className="heach-button--secondary"
                      aria-label={`${text} ${row.role} ${entry.key}`}
                      disabled={pending}
                      onClick={() => void toggle(row.role, entry)}
                    >
                      {text}
                    </Button>
                  );
                },
              },
            ]}
          />
        );
      })}
      {sheet}
    </>
  );
}
