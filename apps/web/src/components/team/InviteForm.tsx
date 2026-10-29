'use client';

import { Button, Notice, TextField } from '@heach/ui';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { useReverified } from '../account/use-reverified';

/**
 * Invites one person by mobile number, after a fresh code. No SMS goes to them (default D-6):
 * the owner tells them, and they see the invitation when they sign in.
 */
export function InviteForm({
  staffRole,
  onInvited,
}: Readonly<{ staffRole: string; onInvited: () => Promise<void> }>) {
  const { t } = useI18n();
  const [mobile, setMobile] = useState('');
  const [sent, setSent] = useState(false);
  const { pending, error, run } = usePending();
  const { attempt, sheet } = useReverified(run);
  const role = t(`roles.${staffRole as 'sample_collector'}.name`);

  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setSent(false);
    void attempt(async () => {
      await api('/organisation/invitations', { method: 'POST', body: JSON.stringify({ mobile }) });
      setMobile('');
      setSent(true);
      await onInvited();
    });
  };

  return (
    <form className="flow__form" onSubmit={submit} noValidate aria-labelledby="invite-title">
      <h2 id="invite-title" className="flow__subtitle">
        {t('team.inviteTitle', { role })}
      </h2>
      <p>{t('team.inviteIntro')}</p>
      <TextField
        label={t('team.inviteMobile')}
        hint={t('signIn.mobileHint')}
        error={error && t(error)}
        type="tel"
        inputMode="numeric"
        maxLength={14}
        value={mobile}
        onChange={(event) => {
          setMobile(event.target.value);
        }}
      />
      {sent && (
        <Notice tone="success" live>
          {t('team.invited')}
        </Notice>
      )}
      <Button type="submit" disabled={pending || mobile.trim() === ''} aria-busy={pending}>
        {t('team.invite')}
      </Button>
      {sheet}
    </form>
  );
}
