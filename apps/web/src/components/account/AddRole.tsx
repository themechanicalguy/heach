'use client';

import { Button, ChoiceGroup, Notice, TextField } from '@heach/ui';
import type { Me } from '@heach/types';
import { LOCALES } from '@heach/i18n';
import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAccount } from '../../lib/account';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { CARE_CHOICES, PROVIDER_CHOICES, type RoleChoice } from '../setup/roles';
import { ReverifySheet } from './ReverifySheet';

/** Adds the side the account lacks; the API asks for a fresh OTP first (decision L-3). */
export function AddRole({ me, onAdded }: Readonly<{ me: Me; onAdded: () => void }>) {
  const { t } = useI18n();
  const { reload } = useAccount();
  const hasCare = me.roles.some((grant) => grant.side === 'care');
  const options: readonly RoleChoice[] = hasCare ? PROVIDER_CHOICES : CARE_CHOICES;
  const [role, setRole] = useState<string>('');
  const [languages, setLanguages] = useState<string[]>([...me.setup.draft.languages]);
  const [organisationName, setOrganisationName] = useState(me.setup.draft.organisationName ?? '');
  const [verifying, setVerifying] = useState(false);
  const { pending, error, setError, run } = usePending();

  const add = () =>
    run(async () => {
      const body = {
        role,
        ...(hasCare ? { languages } : {}),
        ...(role === 'lab' ? { organisationName } : {}),
      };
      try {
        await api('/me/roles', { method: 'POST', body: JSON.stringify(body) });
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === 'reverification_required') {
          setVerifying(true);
          return;
        }
        throw caught;
      }
      onAdded();
      await reload();
    });

  return (
    <section className="flow__card" aria-labelledby="add-role-title">
      <h2 id="add-role-title" className="flow__subtitle">
        {hasCare ? t('account.addProvider') : t('account.addCare')}
      </h2>
      <p>{t('account.addIntro')}</p>
      <ChoiceGroup
        legend={t('account.addTitle')}
        name="add-role"
        choices={options.map((value) => ({
          value,
          label: t(`roles.${value}.label`),
          hint: t(`roles.${value}.hint`),
        }))}
        value={role}
        onChange={(value) => {
          setRole(value);
          setError(undefined);
        }}
      />
      {hasCare && (
        <ChoiceGroup
          legend={t('setup.details.languages')}
          multiple
          choices={LOCALES.map((code) => ({ value: code, label: t(`locale.${code}`), lang: code }))}
          value={languages}
          onChange={(value, checked) => {
            setLanguages(
              checked ? [...languages, value] : languages.filter((each) => each !== value),
            );
          }}
        />
      )}
      {role === 'lab' && (
        <TextField
          label={t('setup.details.organisation')}
          value={organisationName}
          maxLength={120}
          onChange={(event) => {
            setOrganisationName(event.target.value);
          }}
        />
      )}
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      <Button onClick={() => void add()} disabled={!role || pending} aria-busy={pending}>
        {t('account.addTitle')}
      </Button>
      <ReverifySheet
        open={verifying}
        onClose={() => {
          setVerifying(false);
        }}
        onVerified={() => {
          setVerifying(false);
          void add();
        }}
      />
    </section>
  );
}
