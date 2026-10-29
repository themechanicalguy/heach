'use client';

import { ChoiceGroup, Notice } from '@heach/ui';
import type { Invitation, Me } from '@heach/types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAccount } from '../../lib/account';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { CARE_CHOICES, isStaffRole, offered, PROVIDER_CHOICES, type RoleChoice } from './roles';
import { StepActions } from './StepActions';

const INVITED = 'invitation:';

/**
 * Which role to ask for, or a staff invitation sent to this number (O-1). The server grants the
 * role at the end of setup, never from this choice alone. A role saved earlier that is no longer
 * offered (deferred beyond the MVP, ADR 0015) is not preselected; a notice asks for another.
 */
export function RoleStep({ me }: Readonly<{ me: Me }>) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const { reload } = useAccount();
  const draftRole = me.setup.draft.role;
  const offeredRoles: readonly string[] = me.offeredRoles;
  const stale = draftRole !== null && !isStaffRole(draftRole) && !offeredRoles.includes(draftRole);
  const saved = stale ? null : draftRole;
  const { resource } = useResource<Invitation[]>('/me/invitations');
  const invitations = resource.state === 'ready' ? resource.data : [];
  const savedInvitation = isStaffRole(saved)
    ? invitations.find((invitation) => invitation.role === saved)
    : undefined;
  const [picked, setRole] = useState<string | undefined>();
  const role = picked ?? (savedInvitation ? `${INVITED}${savedInvitation.id}` : (saved ?? ''));
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
      const body = role.startsWith(INVITED)
        ? { invitationId: role.slice(INVITED.length) }
        : { role };
      await api('/me/setup', { method: 'PUT', body: JSON.stringify(body) });
      // The details step shows the fields of the role just saved, so it needs the fresh draft.
      await reload();
      router.push(`/${locale}/setup/details`);
    });
  };

  return (
    <form className="flow__form" onSubmit={submit} noValidate>
      <p>{t('setup.role.intro')}</p>
      {stale && <Notice tone="warning">{t('setup.role.unavailable')}</Notice>}
      {invitations.length > 0 && (
        <ChoiceGroup
          legend={t('invitations.setupGroup')}
          name="role"
          choices={invitations.map((invitation) => ({
            value: `${INVITED}${invitation.id}`,
            label: t('invitations.choice', {
              role: t(`roles.${invitation.role}.name`),
              organisation: invitation.organisationName,
            }),
            hint: t(`roles.${invitation.role}.hint`),
          }))}
          value={role}
          onChange={choose}
        />
      )}
      <ChoiceGroup
        legend={t('setup.role.careGroup')}
        name="role"
        choices={choices(offered(CARE_CHOICES, me))}
        value={role}
        onChange={choose}
      />
      <ChoiceGroup
        legend={t('setup.role.providerGroup')}
        name="role"
        choices={choices(offered(PROVIDER_CHOICES, me))}
        value={role}
        onChange={choose}
        error={missing ? t('setup.role.required') : error && t(error)}
      />
      <StepActions submitLabel={t('setup.continue')} pending={pending} />
    </form>
  );
}
