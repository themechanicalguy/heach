import type { Locale } from '@heach/i18n';
import { Button, CheckboxField, ChoiceGroup, Notice, TextField } from '@heach/ui';
import type { AssistedDetails as Details, AssistedSession } from '@heach/types';
import { useState } from 'react';
import { api } from '../api';
import { t } from '../i18n';
import { useAssistedCall, assistedPath, type SessionHandler } from '../use-assisted-call';
import { ErrorNotice } from './AssistedParts';

type Role = Details['role'];
type Gender = NonNullable<Details['gender']>;

const ROLES: Role[] = ['physiotherapist', 'nurse', 'attendant', 'lab'];
const GENDERS: Gender[] = ['female', 'male', 'other', 'undisclosed'];
const LANGUAGES: Locale[] = ['or', 'en', 'hi'];

interface Form {
  role: Role | '';
  fullName: string;
  gender: Gender | '';
  languages: Locale[];
  organisationName: string;
  adultDeclared: boolean;
}

const EMPTY: Form = {
  role: '',
  fullName: '',
  gender: '',
  languages: [],
  organisationName: '',
  adultDeclared: false,
};

/** The body for the details route; name, gender and adult declaration only while not locked. */
function bodyOf(form: Form, locked: boolean): Details | undefined {
  if (form.role === '' || form.languages.length === 0) return undefined;
  const lab = form.role === 'lab';
  if (lab && form.organisationName.trim() === '') return undefined;
  const base: Details = {
    role: form.role,
    languages: form.languages,
    ...(lab ? { organisationName: form.organisationName.trim() } : {}),
  };
  if (locked) return base;
  if (form.fullName.trim() === '' || form.gender === '' || !form.adultDeclared) return undefined;
  return {
    ...base,
    fullName: form.fullName.trim(),
    gender: form.gender,
    adultDeclared: true,
  };
}

interface Props {
  session: AssistedSession;
  onSession: SessionHandler;
}

/** Step 2: provider type and basic details; kept details of an existing account stay as they are. */
export function AssistedDetails({ session, onSession }: Readonly<Props>) {
  const [form, setForm] = useState<Form>(EMPTY);
  const { pending, error, call } = useAssistedCall(onSession);
  const locked = session.basicDetailsLocked;
  const body = bodyOf(form, locked);
  const update = (patch: Partial<Form>) => {
    setForm((current) => ({ ...current, ...patch }));
  };
  const save = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (body)
      void call(() =>
        api<AssistedSession>(assistedPath(session, '/details'), {
          method: 'PUT',
          body: JSON.stringify(body),
        }),
      );
  };
  return (
    <form className="admin-form" onSubmit={save}>
      <h2>{t('assisted.steps.details')}</h2>
      <ChoiceGroup
        legend={t('assisted.details.role')}
        name="assisted-role"
        value={form.role}
        choices={ROLES.map((value) => ({ value, label: t(`assisted.details.roles.${value}`) }))}
        onChange={(value) => {
          update({ role: value as Role });
        }}
      />
      {form.role === 'lab' && (
        <TextField
          label={t('assisted.details.organisation')}
          value={form.organisationName}
          maxLength={120}
          onChange={(event) => {
            update({ organisationName: event.currentTarget.value });
          }}
        />
      )}
      {locked ? (
        <Notice tone="info">{t('assisted.details.locked')}</Notice>
      ) : (
        <BasicFields form={form} update={update} />
      )}
      <ChoiceGroup
        legend={t('assisted.details.languages')}
        multiple
        value={form.languages}
        choices={LANGUAGES.map((value) => ({ value, label: t(`assisted.locales.${value}`) }))}
        onChange={(value, checked) => {
          const others = form.languages.filter((language) => language !== value);
          update({ languages: checked ? [...others, value as Locale] : others });
        }}
      />
      <ErrorNotice error={error} />
      <Button type="submit" disabled={pending || !body}>
        {t('assisted.details.save')}
      </Button>
    </form>
  );
}

interface FieldsProps {
  form: Form;
  update: (patch: Partial<Form>) => void;
}

function BasicFields({ form, update }: Readonly<FieldsProps>) {
  return (
    <>
      <TextField
        label={t('assisted.details.fullName')}
        value={form.fullName}
        maxLength={100}
        onChange={(event) => {
          update({ fullName: event.currentTarget.value });
        }}
      />
      <ChoiceGroup
        legend={t('assisted.details.gender')}
        name="assisted-gender"
        value={form.gender}
        choices={GENDERS.map((value) => ({ value, label: t(`assisted.details.genders.${value}`) }))}
        onChange={(value) => {
          update({ gender: value as Gender });
        }}
      />
      <CheckboxField
        label={t('assisted.details.adult')}
        checked={form.adultDeclared}
        onChange={(event) => {
          update({ adultDeclared: event.currentTarget.checked });
        }}
      />
    </>
  );
}
