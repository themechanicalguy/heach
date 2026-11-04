'use client';

import { Button, Icon, Notice, Sheet, TextField } from '@heach/ui';
import type { HistoryEntry } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { Select } from '../care/SearchView';
import { HISTORY_KINDS } from './record-types';

const belongsTo = (person: string) => (entry: HistoryEntry) =>
  !person || (person === 'self' ? entry.personId == null : entry.personId === person);

/**
 * The health profile as a short summary with Edit (G12, desktop records board): each kind once,
 * its details joined. Editing opens the full history editor as a focused task.
 */
export function HealthProfile({ person }: Readonly<{ person: string }>) {
  const { t } = useI18n();
  const { resource, reload } = useResource<HistoryEntry[]>('/vault/history');
  const [editing, setEditing] = useState(false);
  const entries = resource.state === 'ready' ? resource.data.filter(belongsTo(person)) : [];
  const kinds = HISTORY_KINDS.filter((kind) => entries.some((entry) => entry.kind === kind));
  return (
    <section className="vault-card health-profile" aria-labelledby="health-profile-title">
      <div className="vault-card__head">
        <h2 id="health-profile-title">{t('vault.historyTitle')}</h2>
        <button
          type="button"
          className="heach-button heach-button--link"
          onClick={() => {
            setEditing(true);
          }}
        >
          <Icon name="edit" size={16} />
          {t('vault.edit')}
        </button>
      </div>
      {kinds.length === 0 ? (
        <p className="flow__muted">{t('vault.historyEmpty')}</p>
      ) : (
        <dl className="health-profile__facts">
          {kinds.map((kind) => (
            <div key={kind}>
              <dt>{t(`vault.kinds.${kind}`)}</dt>
              <dd>
                {entries
                  .filter((entry) => entry.kind === kind)
                  .map((entry) => entry.text)
                  .join(', ')}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <Sheet
        open={editing}
        title={t('vault.historyTitle')}
        closeLabel={t('ui.close')}
        onClose={() => {
          setEditing(false);
        }}
      >
        {editing && <HistoryEditor person={person} entries={entries} reload={reload} />}
      </Sheet>
    </section>
  );
}

/** The history editor (MV-07): list with remove, and an add form. Opened from Edit (G12). */
function HistoryEditor({
  person,
  entries,
  reload,
}: Readonly<{ person: string; entries: readonly HistoryEntry[]; reload: () => Promise<void> }>) {
  const { t } = useI18n();
  const [kind, setKind] = useState<string>('allergy');
  const [text, setText] = useState('');
  const { pending, error, run } = usePending();
  return (
    <div className="flow__form">
      <ul className="history-list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <strong>{t(keyFor('vault.kinds', entry.kind, 'vault.historyTitle'))}</strong>:{' '}
            {entry.text}{' '}
            <Button
              className="heach-button--secondary heach-button--compact"
              disabled={pending}
              onClick={() =>
                void run(async () => {
                  await api(`/vault/history/${entry.id}`, { method: 'DELETE' });
                  await reload();
                })
              }
            >
              {t('vault.remove')}
            </Button>
          </li>
        ))}
      </ul>
      <Select
        label={t('vault.historyKind')}
        value={kind}
        onChange={setKind}
        options={HISTORY_KINDS.map((value): [string, string] => [value, t(`vault.kinds.${value}`)])}
      />
      <TextField
        label={t('vault.historyText')}
        value={text}
        onChange={(event) => {
          setText(event.currentTarget.value);
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      <Button
        disabled={pending || !text}
        onClick={() =>
          void run(async () => {
            await api('/vault/history', {
              method: 'POST',
              body: JSON.stringify({
                kind,
                text,
                ...(person && person !== 'self' ? { personId: person } : {}),
              }),
            });
            setText('');
            await reload();
          })
        }
      >
        {t('vault.addHistory')}
      </Button>
    </div>
  );
}
