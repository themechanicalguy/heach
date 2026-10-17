'use client';

import { formatDate } from '@heach/i18n';
import type { CreatedNote, Note } from '@heach/types';
import { Button, Card, EmptyState, ErrorState, Skeleton, TextField, Toast } from '@heach/ui';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n-context';
import { useSession } from '../lib/session';

const MAX_LENGTH = 2000;

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; notes: Note[] };

/** The Step 2 sample: write and read your own encrypted note (EN-13), in your language. */
export function NotesView() {
  const { locale, t } = useI18n();
  const { status } = useSession();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);

  const refresh = useCallback(async () => {
    setLoad({ state: 'loading' });
    try {
      setLoad({ state: 'ready', notes: await api<Note[]>('/sample/notes') });
    } catch {
      setLoad({ state: 'error' });
    }
  }, []);

  useEffect(() => {
    if (status === 'signed-in') void refresh();
  }, [status, refresh]);

  const save = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    await api<CreatedNote>('/sample/notes', {
      method: 'POST',
      body: JSON.stringify({ body: draft }),
    });
    setDraft('');
    setSaved(true);
    await refresh();
  };

  if (status === 'checking') return <Skeleton label={t('state.loading')} />;
  if (status === 'signed-out') {
    return (
      <p>
        <a href={`/${locale}/sign-in`}>{t('auth.test.title')}</a>
      </p>
    );
  }
  const tooLong = draft.length > MAX_LENGTH;
  return (
    <>
      <form onSubmit={(event) => void save(event)}>
        <TextField
          multiline
          label={t('sample.note.label')}
          hint={t('sample.note.hint')}
          error={tooLong ? t('sample.note.tooLong') : undefined}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setSaved(false);
          }}
        />
        <Button type="submit" disabled={draft.trim() === '' || tooLong}>
          {t('sample.note.save')}
        </Button>
      </form>
      {saved && <Toast message={t('sample.note.saved')} tone="success" />}
      <NoteList load={load} onRetry={() => void refresh()} />
    </>
  );

  function NoteList({ load: current, onRetry }: Readonly<{ load: Load; onRetry: () => void }>) {
    if (current.state === 'loading') return <Skeleton label={t('state.loading')} />;
    if (current.state === 'error')
      return (
        <ErrorState message={t('state.error')} retryLabel={t('state.retry')} onRetry={onRetry} />
      );
    if (current.notes.length === 0) return <EmptyState message={t('state.empty')} />;
    return (
      <section aria-labelledby="notes-count">
        <h2 id="notes-count">{t('sample.note.count', { count: current.notes.length })}</h2>
        {current.notes.map((note) => (
          <Card key={note.id} className="note">
            <p className="note__body">{note.body}</p>
            <p className="note__date">
              {t('sample.note.createdAt', { date: formatDate(new Date(note.createdAt), locale) })}
            </p>
          </Card>
        ))}
      </section>
    );
  }
}
