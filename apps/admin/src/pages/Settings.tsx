import { Button, ErrorState, Notice, Skeleton, Table } from '@heach/ui';
import type { Setting } from '@heach/types';
import { useCallback, useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import { usePending } from '../use-pending';
import { useReverified } from '../use-reverified';
import { Checklists } from './Checklists';

/** Operations settings (AD-08): super admin changes one at a time after a fresh TOTP code. */
export function Settings({ canChange }: Readonly<{ canChange: boolean }>) {
  const { loaded, reload } = useLoad(useCallback(() => api<Setting[]>('/settings'), []));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
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
  const save = (key: string, value: string) =>
    attempt(async () => {
      setSaved(false);
      await api('/settings', {
        method: 'PUT',
        body: JSON.stringify({ key, value: Number(value) }),
      });
      setSaved(true);
      reload();
    });
  const rows = [...loaded.value].sort((a, b) => a.key.localeCompare(b.key));
  return (
    <>
      <h1>{t('settings.title')}</h1>
      <p>{t(canChange ? 'settings.intro' : 'settings.readOnly')}</p>
      {error !== undefined && <Notice tone="danger">{errorText(error)}</Notice>}
      {saved && <Notice tone="success">{t('settings.saved')}</Notice>}
      <Table
        caption={t('settings.caption')}
        rows={rows}
        rowKey={(row) => row.key}
        columns={[
          { key: 'key', header: t('settings.key'), cell: (row: Setting) => row.key },
          {
            key: 'value',
            header: t('settings.value'),
            cell: (row: Setting) =>
              canChange ? (
                <input
                  className="heach-input"
                  type="number"
                  aria-label={row.key}
                  value={drafts[row.key] ?? String(row.value)}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setDrafts((current) => ({ ...current, [row.key]: value }));
                  }}
                />
              ) : (
                String(row.value)
              ),
          },
          {
            key: 'save',
            header: '',
            cell: (row: Setting) => {
              const draft = drafts[row.key];
              return canChange ? (
                <Button
                  aria-label={`${t('settings.save')} ${row.key}`}
                  disabled={pending || draft === undefined || draft === String(row.value)}
                  onClick={() => void save(row.key, draft ?? '')}
                >
                  {t('settings.save')}
                </Button>
              ) : null;
            },
          },
        ]}
      />
      {sheet}
      <Checklists canChange={canChange} />
    </>
  );
}
