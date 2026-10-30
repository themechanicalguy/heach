import { Button, Notice, TextField } from '@heach/ui';
import type { ContentPage } from '@heach/types';
import { useCallback, useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import { usePending } from '../use-pending';
import { useReverified } from '../use-reverified';
import { Choice } from './Tickets';

const SLUGS = ['terms', 'privacy', 'faq', 'refunds'];
const LANGUAGES = ['or', 'en', 'hi'];

/** Static pages per language (AD-09): pick a page and a language, then write it. */
export function ContentPages({ canChange }: Readonly<{ canChange: boolean }>) {
  const { loaded, reload } = useLoad(useCallback(() => api<ContentPage[]>('/content/pages'), []));
  const [slug, setSlug] = useState('terms');
  const [locale, setLocale] = useState('or');
  const pages = loaded.state === 'ready' ? loaded.value : [];
  const current = pages.find((page) => page.slug === slug && page.locale === locale);
  return (
    <>
      <h2>{t('content.pages')}</h2>
      <Choice
        label={t('content.page')}
        value={slug}
        onChange={setSlug}
        group="content.slugs"
        values={SLUGS}
      />
      <Choice
        label={t('content.locale')}
        value={locale}
        onChange={setLocale}
        group="content.languages"
        values={LANGUAGES}
      />
      <PageEditor
        key={`${slug}:${locale}:${current?.updatedAt ?? ''}`}
        slug={slug}
        locale={locale}
        page={current}
        canChange={canChange}
        onSaved={reload}
      />
    </>
  );
}

interface EditorProps {
  slug: string;
  locale: string;
  page: ContentPage | undefined;
  canChange: boolean;
  onSaved: () => void;
}

function PageEditor({ slug, locale, page, canChange, onSaved }: Readonly<EditorProps>) {
  const [title, setTitle] = useState(page?.title ?? '');
  const [body, setBody] = useState(page?.body ?? '');
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = usePending();
  const { attempt, sheet } = useReverified(run);
  const save = () =>
    attempt(async () => {
      setSaved(false);
      await api(`/content/pages/${slug}/${locale}`, {
        method: 'PUT',
        body: JSON.stringify({ title, body }),
      });
      setSaved(true);
      onSaved();
    });
  return (
    <form
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <TextField
        label={t('content.pageTitle')}
        required
        readOnly={!canChange}
        value={title}
        onChange={(event) => {
          setTitle(event.currentTarget.value);
        }}
      />
      <TextField
        label={t('content.body')}
        required
        multiline
        readOnly={!canChange}
        value={body}
        onChange={(event) => {
          setBody(event.currentTarget.value);
        }}
      />
      {error !== undefined && <Notice tone="danger">{errorText(error)}</Notice>}
      {saved && <Notice tone="success">{t('content.saved')}</Notice>}
      {canChange && (
        <Button type="submit" disabled={pending}>
          {t('content.savePage')}
        </Button>
      )}
      {sheet}
    </form>
  );
}
