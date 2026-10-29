'use client';

import { ChoiceGroup } from '@heach/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { CARE_CHOICES, PROVIDER_CHOICES, type RoleChoice } from './roles';
import { StepActions } from './StepActions';

/** Which role to ask for. The server grants it at the end of setup, never from this choice alone. */
export function RoleStep({ saved }: Readonly<{ saved: string | null }>) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [role, setRole] = useState(saved ?? '');
  const [missing, setMissing] = useState(false);
  const { pending, error, run } = usePending();
  const choices = (roles: readonly string[]) =>
    roles.map((value) => ({
      value,
      label: t(`roles.${value as RoleChoice}.label`),
      hint: t(`roles.${value as RoleChoice}.hint`),
    }));
  const choose = (value: string) => {
    setRole(value);
    setMissing(false);
  };

  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!role) {
      setMissing(true);
      return;
    }
    void run(async () => {
      await api('/me/setup', { method: 'PUT', body: JSON.stringify({ role }) });
      router.push(`/${locale}/setup/details`);
    });
  };

  return (
    <form className="flow__form" onSubmit={submit} noValidate>
      <p>{t('setup.role.intro')}</p>
      <ChoiceGroup
        legend={t('setup.role.careGroup')}
        name="role"
        choices={choices(CARE_CHOICES)}
        value={role}
        onChange={choose}
      />
      <ChoiceGroup
        legend={t('setup.role.providerGroup')}
        name="role"
        choices={choices(PROVIDER_CHOICES)}
        value={role}
        onChange={choose}
        error={missing ? t('setup.role.required') : error && t(error)}
      />
      <StepActions submitLabel={t('setup.continue')} pending={pending} />
    </form>
  );
}
