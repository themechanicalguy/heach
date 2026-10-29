'use client';

import { Button, Card, Notice, TextField } from '@heach/ui';
import type { Application, ChecklistEntry } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { uploadInit } from '../../lib/files';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { usePending } from '../../lib/use-pending';

interface Props {
  entry: ChecklistEntry;
  editable: boolean;
  onSaved: (application: Application) => void;
}

/** One checklist document (PO-01, PO-02): its state, and a form to upload or replace it. */
export function DocumentItem({ entry, editable, onSaved }: Readonly<Props>) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | undefined>();
  const [reference, setReference] = useState(entry.document?.reference ?? '');
  const [expiresOn, setExpiresOn] = useState(entry.document?.expiresOn ?? '');
  const { pending, error, run } = usePending();
  const document = entry.document;
  const upload = () =>
    run(async () => {
      if (!file) return;
      const extra = {
        ...(entry.reference ? { reference } : {}),
        ...(entry.expiry ? { expiresOn } : {}),
      };
      onSaved(
        await api<Application>(
          `/provider/application/documents/${entry.key}`,
          await uploadInit(file, extra),
        ),
      );
      setFile(undefined);
    });
  const optional = entry.required ? '' : ` (${t('application.optional')})`;
  const title = t(keyFor('application.items', entry.key, 'application.steps.documents')) + optional;

  return (
    <Card title={title}>
      <p className="flow__muted">
        {t(`application.documentState.${document?.scanStatus ?? 'missing'}`)}
      </p>
      {document?.reviewStatus === 'accepted' && (
        <Notice tone="success">{t('application.reviewState.accepted')}</Notice>
      )}
      {document?.reviewStatus === 'rejected' && (
        <Notice tone="warning">
          {t('application.reviewState.rejected', {
            reason: t(
              keyFor(
                'application.reasons',
                document.reviewReason ?? 'other',
                'application.reasons.other',
              ),
            ),
          })}
        </Notice>
      )}
      {editable && (
        <div className="flow__form">
          <TextField
            label={t('application.chooseFile')}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            capture="environment"
            onChange={(event) => {
              setFile(event.currentTarget.files?.[0]);
            }}
          />
          {entry.reference && (
            <TextField
              label={t('application.reference')}
              value={reference}
              maxLength={60}
              onChange={(event) => {
                setReference(event.currentTarget.value);
              }}
            />
          )}
          {entry.expiry && (
            <TextField
              label={t('application.expiresOn')}
              type="date"
              value={expiresOn}
              onChange={(event) => {
                setExpiresOn(event.currentTarget.value);
              }}
            />
          )}
          {error && (
            <Notice tone="danger" live>
              {t(error)}
            </Notice>
          )}
          <Button onClick={() => void upload()} disabled={!file || pending}>
            {t(document ? 'application.replace' : 'application.upload')}
          </Button>
        </div>
      )}
    </Card>
  );
}
