'use client';

import { Button, ChoiceGroup, Notice, TextField } from '@heach/ui';
import type { LinkedPatientInput } from '@heach/types';
import { useState } from 'react';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { ErrorSummary } from '../setup/ErrorSummary';
import { GENDERS } from '../setup/roles';
import {
  EMPTY_LINKED,
  type LinkedError,
  linkedBody,
  linkedErrors,
  linkedFrom,
  RELATIONSHIPS,
} from './linked-form';

const MESSAGES = {
  fullName: 'setup.details.fullNameInvalid',
  birthYear: 'people.birthYearInvalid',
  gender: 'setup.details.genderRequired',
  relationship: 'people.relationshipRequired',
} as const;

interface Props {
  person?: LinkedPatientInput | undefined;
  onSave: (body: LinkedPatientInput) => Promise<void>;
  onCancel: () => void;
}

/** Add or edit one linked patient (AC-03). */
export function LinkedPatientForm({ person, onSave, onCancel }: Readonly<Props>) {
  const { t } = useI18n();
  const [form, setForm] = useState(() => (person ? linkedFrom(person) : EMPTY_LINKED));
  const [shown, setShown] = useState<LinkedError[]>([]);
  const { pending, error, run } = usePending();
  const errorFor = (field: LinkedError) => (shown.includes(field) ? t(MESSAGES[field]) : undefined);
  const update = (change: Partial<typeof form>) => {
    setForm((current) => ({ ...current, ...change }));
  };

  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const errors = linkedErrors(form, new Date().getFullYear());
    setShown(errors);
    if (errors.length === 0) void run(() => onSave(linkedBody(form)));
  };

  return (
    <form className="flow__form" onSubmit={submit} noValidate>
      <ErrorSummary messages={shown.map((field) => t(MESSAGES[field]))} />
      <TextField
        label={t('people.fullName')}
        error={errorFor('fullName')}
        maxLength={100}
        value={form.fullName}
        onChange={(event) => {
          update({ fullName: event.target.value });
        }}
      />
      <TextField
        label={t('people.birthYear')}
        hint={t('people.birthYearHint')}
        error={errorFor('birthYear')}
        inputMode="numeric"
        maxLength={4}
        value={form.birthYear}
        onChange={(event) => {
          update({ birthYear: event.target.value.replace(/\D/g, '') });
        }}
      />
      <ChoiceGroup
        legend={t('setup.details.gender')}
        choices={GENDERS.map((value) => ({ value, label: t(`genders.${value}`) }))}
        value={form.gender}
        error={errorFor('gender')}
        onChange={(value) => {
          update({ gender: value });
        }}
      />
      <ChoiceGroup
        legend={t('people.relationship')}
        choices={RELATIONSHIPS.map((value) => ({
          value,
          label: t(`people.relationships.${value}`),
        }))}
        value={form.relationship}
        error={errorFor('relationship')}
        onChange={(value) => {
          update({ relationship: value });
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {t('people.save')}
      </Button>
      <Button className="heach-button--link" onClick={onCancel} disabled={pending}>
        {t('profile.cancel')}
      </Button>
    </form>
  );
}
