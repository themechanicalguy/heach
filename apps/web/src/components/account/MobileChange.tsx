'use client';

import { Button, Notice, OtpField, TextField } from '@heach/ui';
import type { OtpChallenge } from '@heach/types';
import { useState } from 'react';
import { useAccount } from '../../lib/account';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { useReverified } from './use-reverified';

type Stage = 'closed' | 'number' | 'code' | 'done';

/**
 * Moves the account to a new mobile number (owner decision O-3): a fresh code to the current
 * number first, then a code to the new one. Every other device is signed out.
 */
export function MobileChange() {
  const { t } = useI18n();
  const { reload } = useAccount();
  const [stage, setStage] = useState<Stage>('closed');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<OtpChallenge | undefined>();
  const { pending, error, run } = usePending();
  const { attempt, sheet } = useReverified(run);

  const start = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    void attempt(async () => {
      const body = JSON.stringify({ mobile });
      setChallenge(await api<OtpChallenge>('/me/mobile', { method: 'POST', body }));
      setStage('code');
    });
  };
  const confirm = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!challenge) return;
    void run(async () => {
      const body = JSON.stringify({ challengeId: challenge.challengeId, code });
      await api('/me/mobile/verify', { method: 'POST', body });
      setStage('done');
      setCode('');
      await reload();
    });
  };

  let content;
  if (stage === 'closed' || stage === 'done') {
    content = (
      <>
        {stage === 'done' && (
          <Notice tone="success" live>
            {t('mobileChange.done')}
          </Notice>
        )}
        <p>{t('mobileChange.intro')}</p>
        <Button
          className="heach-button--secondary"
          onClick={() => {
            setStage('number');
          }}
        >
          {t('mobileChange.start')}
        </Button>
      </>
    );
  } else if (stage === 'number') {
    content = (
      <form className="flow__form" onSubmit={start} noValidate>
        <TextField
          label={t('mobileChange.newNumber')}
          hint={t('signIn.mobileHint')}
          error={error && t(error)}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={14}
          value={mobile}
          onChange={(event) => {
            setMobile(event.target.value);
          }}
        />
        <Button type="submit" disabled={pending || mobile.trim() === ''} aria-busy={pending}>
          {t('mobileChange.sendCode')}
        </Button>
      </form>
    );
  } else {
    content = (
      <form className="flow__form" onSubmit={confirm} noValidate>
        <p role="status">{t('mobileChange.codeSent')}</p>
        <OtpField
          label={t('signIn.codeLabel')}
          error={error && t(error)}
          value={code}
          onChange={(event) => {
            setCode(event.target.value.replace(/\D/g, ''));
          }}
        />
        <Button type="submit" disabled={pending || code.length !== 6} aria-busy={pending}>
          {t('mobileChange.confirm')}
        </Button>
      </form>
    );
  }

  return (
    <section className="flow__card" aria-labelledby="mobile-change-title">
      <h2 id="mobile-change-title" className="flow__subtitle">
        {t('mobileChange.title')}
      </h2>
      {content}
      {sheet}
    </section>
  );
}
