'use client';

import { Button, CheckboxField, ChoiceGroup, Notice, TextField } from '@heach/ui';
import type { SetupDraft } from '@heach/types';
import { LOCALES } from '@heach/i18n';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import {
  type DetailsError,
  type DetailsForm,
  detailsErrors,
  detailsFrom,
  validPart,
} from './details-form';
import { ErrorSummary } from './ErrorSummary';
import { GENDERS, isProviderChoice } from './roles';
import { StepActions } from './StepActions';

const MESSAGES = {
  fullName: 'setup.details.fullNameInvalid',
  gender: 'setup.details.genderRequired',
  languages: 'setup.details.languagesRequired',
  organisation: 'setup.details.organisationRequired',
  adult: 'setup.details.adultRequired',
} as const;

/** Basic details for the chosen role, saved to resume later (PO-03, decision L-5). */
export function DetailsStep({ draft }: Readonly<{ draft: SetupDraft }>) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState(() => detailsFrom(draft));
  const [shown, setShown] = useState<DetailsError[]>([]);
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = usePending();
  const errorFor = (field: DetailsError) =>
    shown.includes(field) ? t(MESSAGES[field]) : undefined;
  const update = (change: Partial<typeof form>) => {
    setForm((current) => ({ ...current, ...change }));
    setSaved(false);
  };

  const save = (body: Record<string, unknown>) =>
    api('/me/setup', { method: 'PUT', body: JSON.stringify(body) });
  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const errors = detailsErrors(form, draft.role);
    setShown(errors);
    if (errors.length > 0) return;
    void run(async () => {
      await save(validPart(form, draft.role));
      router.push(`/${locale}/setup/consent`);
    });
  };
  const saveLater = () =>
    run(async () => {
      await save(validPart(form, draft.role));
      setSaved(true);
    });

  return (
    <form className="flow__form" onSubmit={submit} noValidate>
      <p>{t('setup.details.intro')}</p>
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
      <ProviderFields role={draft.role} form={form} errorFor={errorFor} update={update} />
      <CheckboxField
        label={t('setup.details.adult')}
        error={errorFor('adult')}
        checked={form.adultDeclared}
        onChange={(event) => {
          update({ adultDeclared: event.target.checked });
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      {saved && (
        <Notice tone="success" live>
          {t('setup.saved')}
        </Notice>
      )}
      <StepActions
        submitLabel={t('setup.continue')}
        pending={pending}
        back={`/${locale}/setup/role`}
      />
      <Button
        className="heach-button--link flow__later"
        onClick={() => void saveLater()}
        disabled={pending}
      >
        {t('setup.saveLater')}
      </Button>
    </form>
  );
}

interface ProviderFieldsProps {
  role: string | null;
  form: DetailsForm;
  errorFor: (field: DetailsError) => string | undefined;
  update: (change: Partial<DetailsForm>) => void;
}

/** Languages spoken (every provider) and the lab's name (labs), PO-01. */
function ProviderFields({ role, form, errorFor, update }: Readonly<ProviderFieldsProps>) {
  const { t } = useI18n();
  if (!isProviderChoice(role)) return null;
  return (
    <>
      <ChoiceGroup
        legend={t('setup.details.languages')}
        multiple
        choices={LOCALES.map((code) => ({ value: code, label: t(`locale.${code}`), lang: code }))}
        value={form.languages}
        error={errorFor('languages')}
        onChange={(value, checked) => {
          update({
            languages: checked
              ? [...form.languages, value]
              : form.languages.filter((each) => each !== value),
          });
        }}
      />
      {role === 'lab' && (
        <TextField
          label={t('setup.details.organisation')}
          hint={t('setup.details.organisationHint')}
          error={errorFor('organisation')}
          maxLength={120}
          value={form.organisationName}
          onChange={(event) => {
            update({ organisationName: event.target.value });
          }}
        />
      )}
    </>
  );
}
