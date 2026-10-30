import { Button, ErrorState, Notice, Skeleton, Table, TextField } from '@heach/ui';
import type { ContentTemplate } from '@heach/types';
import { useCallback, useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import { usePending } from '../use-pending';
import { useReverified } from '../use-reverified';
import { ContentPages } from './ContentPages';
import { label } from './labels';

/** Content (AD-09): notification wording and static pages, changed by super admin only. */
export function Content({ canChange }: Readonly<{ canChange: boolean }>) {
  return (
    <>
      <h1>{t('content.title')}</h1>
      <p>{t(canChange ? 'content.intro' : 'content.readOnly')}</p>
      <Templates canChange={canChange} />
      <ContentPages canChange={canChange} />
    </>
  );
}

function Templates({ canChange }: Readonly<{ canChange: boolean }>) {
  const { loaded, reload } = useLoad(
    useCallback(() => api<ContentTemplate[]>('/content/templates'), []),
  );
  const [editing, setEditing] = useState<ContentTemplate | undefined>();
  return (
    <>
      <h2>{t('content.templates')}</h2>
      {loaded.state === 'loading' && <Skeleton label={t('state.loading')} />}
      {loaded.state === 'error' && (
        <ErrorState
          message={errorText(loaded.error)}
          retryLabel={t('state.retry')}
          onRetry={reload}
        />
      )}
      {loaded.state === 'ready' && (
        <Table
          caption={t('content.templates')}
          rows={loaded.value}
          rowKey={(row) => `${row.template}:${row.locale}`}
          columns={[
            {
              key: 'template',
              header: t('content.template'),
              cell: (row: ContentTemplate) => row.template,
            },
            {
              key: 'locale',
              header: t('content.locale'),
              cell: (row: ContentTemplate) => label('content.languages', row.locale),
            },
            {
              key: 'text',
              header: t('content.text'),
              cell: (row: ContentTemplate) => row.override ?? row.defaultText,
            },
            {
              key: 'edit',
              header: '',
              cell: (row: ContentTemplate) =>
                canChange ? (
                  <Button
                    className="heach-button--secondary"
                    aria-label={`${t('content.edit')} ${row.template} ${row.locale}`}
                    onClick={() => {
                      setEditing(row);
                    }}
                  >
                    {t('content.edit')}
                  </Button>
                ) : null,
            },
          ]}
        />
      )}
      {editing && (
        <TemplateEditor
          key={`${editing.template}:${editing.locale}`}
          template={editing}
          onSaved={reload}
        />
      )}
    </>
  );
}

function TemplateEditor({
  template,
  onSaved,
}: Readonly<{ template: ContentTemplate; onSaved: () => void }>) {
  const [text, setText] = useState(template.override ?? template.defaultText);
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = usePending();
  const { attempt, sheet } = useReverified(run);
  const put = (value: string | null) =>
    attempt(async () => {
      setSaved(false);
      await api(`/content/templates/${template.template}/${template.locale}`, {
        method: 'PUT',
        body: JSON.stringify({ text: value }),
      });
      setSaved(true);
      onSaved();
    });
  const list = template.placeholders.map((name) => `{${name}}`).join(', ');
  return (
    <div className="admin-form">
      <TextField
        label={`${template.template} (${label('content.languages', template.locale)})`}
        hint={t('content.placeholders', { list: list || t('content.none') })}
        multiline
        value={text}
        onChange={(event) => {
          setText(event.currentTarget.value);
        }}
      />
      {error !== undefined && <Notice tone="danger">{errorText(error)}</Notice>}
      {saved && <Notice tone="success">{t('content.saved')}</Notice>}
      <Button disabled={pending || !text.trim()} onClick={() => void put(text)}>
        {t('content.save')}
      </Button>
      <Button className="heach-button--secondary" disabled={pending} onClick={() => void put(null)}>
        {t('content.reset')}
      </Button>
      {sheet}
    </div>
  );
}
