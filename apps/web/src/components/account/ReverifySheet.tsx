'use client';

import { Button, OtpField, Sheet } from '@heach/ui';
import type { OtpChallenge } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';

interface Props {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
}

/** A fresh OTP to the account's own number before a sensitive action (AC-05, decision L-11). */
export function ReverifySheet({ open, onClose, onVerified }: Readonly<Props>) {
  const { t } = useI18n();
  const [challenge, setChallenge] = useState<OtpChallenge | undefined>();
  const [code, setCode] = useState('');
  const { pending, error, run } = usePending();

  const send = () =>
    run(async () => {
      setChallenge(await api<OtpChallenge>('/auth/reverify', { method: 'POST' }));
    });
  const confirm = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!challenge) return;
    void run(async () => {
      await api('/auth/reverify/verify', {
        method: 'POST',
        body: JSON.stringify({ challengeId: challenge.challengeId, code }),
      });
      setChallenge(undefined);
      setCode('');
      onVerified();
    });
  };

  return (
    <Sheet
      open={open}
      title={t('reverify.title')}
      closeLabel={t('reverify.cancel')}
      onClose={onClose}
    >
      {challenge ? (
        <form className="flow__form" onSubmit={confirm} noValidate>
          <p role="status">{t('reverify.sent')}</p>
          <OtpField
            label={t('signIn.codeLabel')}
            error={error && t(error)}
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, ''));
            }}
          />
          <Button type="submit" disabled={pending || code.length !== 6} aria-busy={pending}>
            {t('reverify.confirm')}
          </Button>
        </form>
      ) : (
        <div className="flow__form">
          <p>{t('reverify.intro')}</p>
          {error && (
            <p className="heach-field__error" role="alert">
              {t(error)}
            </p>
          )}
          <Button onClick={() => void send()} disabled={pending} aria-busy={pending}>
            {t('reverify.send')}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
