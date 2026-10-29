import { formatDateTime } from '@heach/i18n';
import { Button, EmptyState, ErrorState, Notice, Skeleton, Table, TextField } from '@heach/ui';
import type { Ticket, TicketRestricted } from '@heach/types';
import { useCallback, useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import { usePending } from '../use-pending';
import { label } from './labels';
import en from '../../messages/en.json';

/** The complaints and safety queue (AD-06): P0 first; private text only through break-glass (SE-03). */
export function Tickets() {
  const { loaded, reload } = useLoad(useCallback(() => api<Ticket[]>('/tickets'), []));
  const [selected, setSelected] = useState<Ticket | undefined>();
  return (
    <>
      <h1>{t('tickets.title')}</h1>
      <p>{t('tickets.intro')}</p>
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
            <EmptyState message={t('tickets.empty')} />
          )}
          {loaded.state === 'ready' && loaded.value.length > 0 && (
            <Table
              caption={t('tickets.caption')}
              rows={loaded.value}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: 'priority',
                  header: t('tickets.priority'),
                  cell: (row: Ticket) => row.priority.toUpperCase(),
                },
                { key: 'kind', header: t('tickets.kind'), cell: (row: Ticket) => row.kind },
                { key: 'topic', header: t('tickets.topic'), cell: (row: Ticket) => row.topic },
                { key: 'status', header: t('tickets.status'), cell: (row: Ticket) => row.status },
                {
                  key: 'raised',
                  header: t('tickets.raised'),
                  cell: (row: Ticket) => formatDateTime(new Date(row.createdAt), 'en'),
                },
                {
                  key: 'open',
                  header: '',
                  cell: (row: Ticket) => (
                    <Button
                      className="heach-button--secondary"
                      aria-label={`${t('tickets.open')} ${row.id}`}
                      onClick={() => {
                        setSelected(row);
                      }}
                    >
                      {t('tickets.open')}
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </div>
        {selected && (
          <TicketPanel
            key={selected.id}
            ticket={selected}
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

function TicketPanel({
  ticket,
  onChanged,
  onClose,
}: Readonly<{ ticket: Ticket; onChanged: () => void; onClose: () => void }>) {
  const [restricted, setRestricted] = useState<TicketRestricted | undefined>();
  const [why, setWhy] = useState('safety_investigation');
  const [note, setNote] = useState('');
  const [resolution, setResolution] = useState('resolved_with_patient');
  const [done, setDone] = useState(false);
  const { pending, error, run } = usePending();
  const post = (path: string, body?: object) =>
    api<undefined>(`/tickets/${ticket.id}/${path}`, {
      method: 'POST',
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const act = (work: () => Promise<void>) =>
    run(async () => {
      await work();
      setDone(true);
      onChanged();
    });
  const open = () =>
    run(async () => {
      await post('break-glass', { reason: why });
      setRestricted(await api<TicketRestricted>(`/tickets/${ticket.id}/restricted`));
    });
  return (
    <aside className="admin-panel" aria-label={ticket.topic}>
      <h2>{`${ticket.priority.toUpperCase()} · ${ticket.topic}`}</h2>
      {done && (
        <Notice tone="success" live>
          {t('tickets.done')}
        </Notice>
      )}
      {error !== undefined && <Notice tone="danger">{errorText(error)}</Notice>}
      <Button onClick={() => void act(() => post('assign'))} disabled={pending}>
        {t('tickets.assign')}
      </Button>
      {restricted ? (
        <section aria-label={t('tickets.description')}>
          <h3>
            {t('tickets.restricted', {
              time: formatDateTime(new Date(restricted.grantExpiresAt), 'en'),
            })}
          </h3>
          <p>{restricted.description ?? '—'}</p>
          <h4>{t('tickets.notes')}</h4>
          <ul className="admin-list">
            {restricted.notes.map((text, index) => (
              <li key={`note-${String(index)}`}>{text}</li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="admin-actions">
          <Choice
            label={t('tickets.reason')}
            value={why}
            onChange={setWhy}
            group="tickets.reasons"
            values={Object.keys(en.tickets.reasons)}
          />
          <Button className="heach-button--danger" onClick={() => void open()} disabled={pending}>
            {t('tickets.breakGlass')}
          </Button>
        </div>
      )}
      <TextField
        label={t('tickets.note')}
        multiline
        value={note}
        onChange={(event) => {
          setNote(event.currentTarget.value);
        }}
      />
      <Button
        className="heach-button--secondary"
        disabled={pending || !note}
        onClick={() => void act(() => post('notes', { note }))}
      >
        {t('tickets.addNote')}
      </Button>
      <Choice
        label={t('tickets.resolution')}
        value={resolution}
        onChange={setResolution}
        group="tickets.resolutions"
        values={Object.keys(en.tickets.resolutions)}
      />
      <Button disabled={pending} onClick={() => void act(() => post('resolve', { resolution }))}>
        {t('tickets.resolve')}
      </Button>
      <Button className="heach-button--secondary" onClick={onClose}>
        {t('tickets.close')}
      </Button>
    </aside>
  );
}

interface ChoiceProps {
  label: string;
  value: string;
  values: readonly string[];
  group: string;
  onChange: (value: string) => void;
}

export function Choice({ label: text, value, values, group, onChange }: Readonly<ChoiceProps>) {
  return (
    <label className="heach-field">
      <span className="heach-field__label">{text}</span>
      <select
        className="heach-input"
        value={value}
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
      >
        {values.map((option) => (
          <option key={option} value={option}>
            {label(group, option)}
          </option>
        ))}
      </select>
    </label>
  );
}
