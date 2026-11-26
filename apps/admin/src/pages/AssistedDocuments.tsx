import { Button, Card, TextField } from '@heach/ui';
import type { AssistedSession } from '@heach/types';
import { useState } from 'react';
import { api } from '../api';
import { uploadInit } from '../files';
import { t } from '../i18n';
import { assistedPath, useAssistedCall, type StepProps } from '../use-assisted-call';
import { ErrorNotice, FileField } from './AssistedParts';
import { label } from './labels';

type Entry = StepProps['application']['items'][number];

interface RowProps {
  session: AssistedSession;
  entry: Entry;
  editable: boolean;
  onSession: StepProps['onSession'];
}

/** One checklist document: its state (never its content), and a form to upload or replace it. */
function DocumentRow({ session, entry, editable, onSession }: Readonly<RowProps>) {
  const [file, setFile] = useState<File | undefined>();
  const [reference, setReference] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [version, setVersion] = useState(0);
  const { pending, error, call } = useAssistedCall(onSession);
  const document = entry.document;
  const upload = () =>
    call(async () => {
      if (!file) throw new Error('no file');
      const extra = {
        ...(entry.reference ? { reference } : {}),
        ...(entry.expiry ? { expiresOn } : {}),
      };
      const next = await api<AssistedSession>(
        assistedPath(session, `/documents/${encodeURIComponent(entry.key)}`),
        await uploadInit(file, extra),
      );
      setFile(undefined);
      setReference('');
      setExpiresOn('');
      setVersion((current) => current + 1);
      return next;
    });
  const optional = entry.required ? '' : ` (${t('assisted.documents.optional')})`;
  const state = document
    ? `${label('verification.scan', document.scanStatus)} · ${label('verification.review', document.reviewStatus)}`
    : t('assisted.documents.none');
  return (
    <Card title={entry.key + optional}>
      <p>{state}</p>
      {editable && (
        <div className="admin-form">
          <FileField
            label={t('assisted.documents.file')}
            accept="application/pdf,image/jpeg,image/png"
            version={version}
            onFile={setFile}
          />
          {entry.reference && (
            <TextField
              label={t('assisted.documents.number')}
              value={reference}
              maxLength={60}
              autoComplete="off"
              onChange={(event) => {
                setReference(event.currentTarget.value);
              }}
            />
          )}
          {entry.expiry && (
            <TextField
              label={t('assisted.documents.expires')}
              type="date"
              value={expiresOn}
              onChange={(event) => {
                setExpiresOn(event.currentTarget.value);
              }}
            />
          )}
          <ErrorNotice error={error} />
          <Button onClick={() => void upload()} disabled={!file || pending}>
            {document ? t('assisted.documents.replace') : t('assisted.documents.upload')}
          </Button>
        </div>
      )}
    </Card>
  );
}

/** Step 3: the checklist documents, one row each. */
export function AssistedDocuments({ session, application, onSession }: Readonly<StepProps>) {
  return (
    <section aria-label={t('assisted.steps.documents')}>
      <h2>{t('assisted.steps.documents')}</h2>
      {application.items.length === 0 && <p>{t('assisted.documents.empty')}</p>}
      {application.items.map((entry) => (
        <DocumentRow
          key={entry.key}
          session={session}
          entry={entry}
          editable={application.editable}
          onSession={onSession}
        />
      ))}
    </section>
  );
}
