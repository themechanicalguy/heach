'use client';

import { Button, ChoiceGroup, Notice, TextField } from '@heach/ui';
import type { Application } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { uploadInit } from '../../lib/files';
import { useI18n } from '../../lib/i18n-context';
import { withPrepared } from '../../lib/photo';
import { usePending } from '../../lib/use-pending';

// Never an Aadhaar card: its copy would carry the full number (PR-03).
const KINDS = ['voter_id', 'passport', 'driving_licence', 'pan_card'] as const;
type Kind = (typeof KINDS)[number];

interface Props {
  application: Application;
  consented: boolean;
  onSaved: (application: Application) => void;
}

/** The manual fallback (KY-07): another identity document, checked by a verifier. */
export function IdentityFallback({ application, consented, onSaved }: Readonly<Props>) {
  const { locale, t } = useI18n();
  const [kind, setKind] = useState<Kind>(application.identityDocumentKind ?? 'voter_id');
  const [file, setFile] = useState<File | undefined>();
  const { pending, error, run } = usePending();
  const upload = () =>
    run(async () => {
      if (!file) return;
      const extra = { kind, locale, consentVersion: application.identityConsentVersion };
      onSaved(
        await api<Application>(
          '/provider/application/identity/document',
          await uploadInit(file, extra),
        ),
      );
      setFile(undefined);
    });
  return (
    <div className="flow__form">
      <h3>{t('application.identityFallback.title')}</h3>
      <p className="flow__muted">{t('application.identityFallback.intro')}</p>
      <Notice tone="warning">{t('application.identityFallback.noAadhaar')}</Notice>
      <ChoiceGroup
        legend={t('application.identityFallback.kind')}
        choices={KINDS.map((value) => ({
          value,
          label: t(`application.identityFallback.kinds.${value}`),
        }))}
        value={kind}
        onChange={(value) => {
          setKind(value as Kind);
        }}
      />
      <TextField
        label={t('application.chooseFile')}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        capture="environment"
        onChange={(event) => {
          withPrepared(event.currentTarget.files?.[0], setFile);
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      <Button
        className="heach-button--secondary"
        onClick={() => void upload()}
        disabled={!file || !consented || pending}
      >
        {t('application.identityFallback.upload')}
      </Button>
    </div>
  );
}
