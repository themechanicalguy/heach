import { Button, Notice, TextField } from '@heach/ui';
import type { AssistedSession } from '@heach/types';
import { useState } from 'react';
import { api } from '../api';
import { uploadInit } from '../files';
import { t } from '../i18n';
import { assistedPath, useAssistedCall, type StepProps } from '../use-assisted-call';
import { ErrorNotice, FileField } from './AssistedParts';

function DetailsForm({ session, application, onSession }: Readonly<StepProps>) {
  const { profile } = application;
  const [qualifications, setQualifications] = useState(profile.qualifications ?? '');
  const [experience, setExperience] = useState(profile.experienceYears?.toString() ?? '');
  const [saved, setSaved] = useState(false);
  const { pending, error, call } = useAssistedCall(onSession);
  const save = () =>
    call(async () => {
      setSaved(false);
      const body = {
        qualifications,
        ...(experience === '' ? {} : { experienceYears: Number(experience) }),
      };
      const next = await api<AssistedSession>(assistedPath(session, '/profile'), {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setSaved(true);
      return next;
    });
  return (
    <div className="admin-form">
      <TextField
        multiline
        label={t('assisted.profile.qualifications')}
        maxLength={300}
        value={qualifications}
        onChange={(event) => {
          setQualifications(event.currentTarget.value);
        }}
      />
      <TextField
        label={t('assisted.profile.experience')}
        type="number"
        inputMode="numeric"
        min={0}
        max={60}
        value={experience}
        onChange={(event) => {
          setExperience(event.currentTarget.value);
        }}
      />
      <ErrorNotice error={error} />
      {saved && (
        <Notice tone="success" live>
          {t('assisted.saved')}
        </Notice>
      )}
      <Button onClick={() => void save()} disabled={pending}>
        {t('assisted.profile.save')}
      </Button>
    </div>
  );
}

function PhotoForm({ session, application, onSession }: Readonly<StepProps>) {
  const [file, setFile] = useState<File | undefined>();
  const [version, setVersion] = useState(0);
  const { pending, error, call } = useAssistedCall(onSession);
  const upload = () =>
    call(async () => {
      if (!file) throw new Error('no file');
      const next = await api<AssistedSession>(
        assistedPath(session, '/photo'),
        await uploadInit(file),
      );
      setFile(undefined);
      setVersion((current) => current + 1);
      return next;
    });
  if (application.profile.photoVerified) return null;
  return (
    <div className="admin-form">
      {application.profile.hasPhoto && (
        <Notice tone="success">{t('assisted.profile.photoOnFile')}</Notice>
      )}
      <FileField
        label={t('assisted.profile.photo')}
        accept="image/jpeg,image/png"
        version={version}
        onFile={setFile}
      />
      <ErrorNotice error={error} />
      <Button onClick={() => void upload()} disabled={!file || pending}>
        {t('assisted.profile.uploadPhoto')}
      </Button>
    </div>
  );
}

/** Step 5: what patients see on the public profile (PO-05): qualifications, experience, photo. */
export function AssistedProfile(props: Readonly<StepProps>) {
  return (
    <section aria-label={t('assisted.steps.profile')}>
      <h2>{t('assisted.steps.profile')}</h2>
      <DetailsForm {...props} />
      <PhotoForm {...props} />
    </section>
  );
}
