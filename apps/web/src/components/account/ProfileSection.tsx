'use client';

import { Button, ChoiceGroup, Notice, TextField } from '@heach/ui';
import type { Me } from '@heach/types';
import { useState } from 'react';
import { useAccount } from '../../lib/account';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import {
  correctionFrom,
  type DetailsError,
  detailsErrors,
  detailsFrom,
} from '../setup/details-form';
import { MESSAGES, ProviderFields } from '../setup/DetailsStep';
import { ErrorSummary } from '../setup/ErrorSummary';
import { GENDERS } from '../setup/roles';

/** The role whose fields the profile has: the provider side if any, else the care side. */
function profileRole(me: Me): string | null {
  return (me.roles.find((grant) => grant.side === 'provider') ?? me.roles[0])?.role ?? null;
}

/** View and correct basic details after setup (AC-06). */
export function ProfileSection({ me }: Readonly<{ me: Me }>) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const draft = me.setup.draft;
  return (
    <section className="flow__card" aria-labelledby="profile-title">
      <h2 id="profile-title" className="flow__subtitle">
        {t('profile.title')}
      </h2>
      {editing ? (
        <ProfileForm
          me={me}
          onDone={() => {
            setEditing(false);
          }}
        />
      ) : (
        <>
          <dl className="facts">
            <dt>{t('setup.details.fullName')}</dt>
            <dd>{draft.fullName ?? '—'}</dd>
            <dt>{t('setup.details.gender')}</dt>
            <dd>{draft.gender ? t(`genders.${draft.gender}`) : '—'}</dd>
            {draft.organisationName && (
              <>
                <dt>{t('setup.details.organisation')}</dt>
                <dd>{draft.organisationName}</dd>
              </>
            )}
          </dl>
          <Button
            className="heach-button--secondary"
            onClick={() => {
              setEditing(true);
            }}
          >
            {t('profile.edit')}
          </Button>
        </>
      )}
    </section>
  );
}

function ProfileForm({ me, onDone }: Readonly<{ me: Me; onDone: () => void }>) {
  const { t } = useI18n();
  const { reload } = useAccount();
  const role = profileRole(me);
  const [form, setForm] = useState(() => detailsFrom(me.setup.draft));
  const [shown, setShown] = useState<DetailsError[]>([]);
  const { pending, error, run } = usePending();
  const errorFor = (field: DetailsError) =>
    shown.includes(field) ? t(MESSAGES[field]) : undefined;
  const update = (change: Partial<typeof form>) => {
    setForm((current) => ({ ...current, ...change }));
  };

  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const errors = detailsErrors(form, role).filter((field) => field !== 'adult');
    setShown(errors);
    if (errors.length > 0) return;
    void run(async () => {
      const body = JSON.stringify(correctionFrom(form, role));
      await api('/me/profile', { method: 'PUT', body });
      await reload();
      onDone();
    });
  };

  return (
    <form className="flow__form" onSubmit={submit} noValidate>
      <ErrorSummary messages={shown.map((field) => t(MESSAGES[field]))} />
      <TextField
        label={t('setup.details.fullName')}
        hint={t('setup.details.fullNameHint')}
        error={errorFor('fullName')}
        autoComplete="name"
        maxLength={100}
        value={form.fullName}
        onChange={(event) => {
          update({ fullName: event.target.value });
        }}
      />
      <ChoiceGroup
        legend={t('setup.details.gender')}
        choices={GENDERS.map((value) => ({ value, label: t(`genders.${value}`) }))}
        value={form.gender}
        error={errorFor('gender')}
        onChange={(value) => {
          update({ gender: value as typeof form.gender });
        }}
      />
      <ProviderFields role={role} form={form} errorFor={errorFor} update={update} />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {t('profile.save')}
      </Button>
      <Button className="heach-button--link" onClick={onDone} disabled={pending}>
        {t('profile.cancel')}
      </Button>
    </form>
  );
}
