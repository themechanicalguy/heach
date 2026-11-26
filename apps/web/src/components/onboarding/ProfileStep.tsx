'use client';

import { Button, Card, Notice, TextField } from '@heach/ui';
import type { Application } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { uploadInit } from '../../lib/files';
import { useI18n } from '../../lib/i18n-context';
import { withPrepared } from '../../lib/photo';
import { usePending } from '../../lib/use-pending';
import { StoredImage } from '../StoredImage';

type Profile = Application['profile'];

interface Props {
  application: Application;
  onSaved: (application: Application) => void;
}

/** What patients see on the public profile (PO-05): qualifications, experience and a photo. */
export function ProfileStep({ application, onSaved }: Readonly<Props>) {
  const { t } = useI18n();
  const saved = (profile: Profile) => {
    onSaved({ ...application, profile });
  };
  return (
    <Card title={t('application.steps.profile')}>
      <p className="flow__muted">{t('application.profile.intro')}</p>
      <DetailsForm application={application} onSaved={saved} />
      <PhotoForm application={application} onSaved={saved} />
    </Card>
  );
}

interface FormProps {
  application: Application;
  onSaved: (profile: Profile) => void;
}

function DetailsForm({ application, onSaved }: Readonly<FormProps>) {
  const { t } = useI18n();
  const { profile, editable } = application;
  const [qualifications, setQualifications] = useState(profile.qualifications ?? '');
  const [experience, setExperience] = useState(profile.experienceYears?.toString() ?? '');
  const [done, setDone] = useState(false);
  const { pending, error, run } = usePending();
  const save = () =>
    run(async () => {
      setDone(false);
      const body = {
        qualifications,
        ...(experience === '' ? {} : { experienceYears: Number(experience) }),
      };
      onSaved(
        await api<Profile>('/provider/profile', { method: 'PUT', body: JSON.stringify(body) }),
      );
      setDone(true);
    });
  return (
    <div className="flow__form">
      <TextField
        multiline
        label={t('application.profile.qualifications')}
        hint={t('application.profile.qualificationsHint')}
        maxLength={300}
        value={qualifications}
        disabled={!editable}
        onChange={(event) => {
          setQualifications(event.currentTarget.value);
        }}
      />
      <TextField
        label={t('application.profile.experience')}
        type="number"
        inputMode="numeric"
        min={0}
        max={60}
        value={experience}
        disabled={!editable}
        onChange={(event) => {
          setExperience(event.currentTarget.value);
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      {done && (
        <Notice tone="success" live>
          {t('application.profile.saved')}
        </Notice>
      )}
      {editable && (
        <Button onClick={() => void save()} disabled={pending}>
          {t('application.profile.save')}
        </Button>
      )}
    </div>
  );
}

function PhotoForm({ application, onSaved }: Readonly<FormProps>) {
  const { t } = useI18n();
  const { profile, editable } = application;
  const [file, setFile] = useState<File | undefined>();
  const [version, setVersion] = useState(0);
  const { pending, error, run } = usePending();
  const upload = () =>
    run(async () => {
      if (!file) return;
      onSaved(await api<Profile>('/provider/profile/photo', await uploadInit(file)));
      setFile(undefined);
      setVersion((current) => current + 1);
    });
  return (
    <div className="flow__form">
      <h3>{t('application.profile.photo')}</h3>
      {profile.hasPhoto ? (
        <StoredImage
          key={version}
          path="/provider/profile/photo"
          alt={t('application.profile.ownPhotoAlt')}
        />
      ) : (
        <p className="flow__muted">{t('application.profile.noPhoto')}</p>
      )}
      {profile.photoVerified && (
        <Notice tone="info">{t('application.profile.photoVerified')}</Notice>
      )}
      {editable && !profile.photoVerified && (
        <>
          <TextField
            label={t('application.profile.photoHint')}
            type="file"
            accept="image/jpeg,image/png"
            capture="user"
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
            disabled={!file || pending}
          >
            {t('application.profile.uploadPhoto')}
          </Button>
        </>
      )}
    </div>
  );
}
