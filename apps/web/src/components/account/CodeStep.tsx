'use client';

import { Button, OtpField } from '@heach/ui';
import type { AccessToken, OtpChallenge } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { useCountdown } from '../../lib/use-countdown';
import { usePending } from '../../lib/use-pending';
import { StepActions } from '../setup/StepActions';

interface Props {
  challenge: OtpChallenge;
  lastDigits: string;
  onSignedIn: (accessToken: string) => Promise<void>;
  onChangeNumber: () => void;
}

/** The six-digit code from the SMS, with a resend after the cooldown (SE-08). */
export function CodeStep({ challenge, lastDigits, onSignedIn, onChangeNumber }: Readonly<Props>) {
  const { locale, t } = useI18n();
  const [code, setCode] = useState('');
  const [resendAt, setResendAt] = useState(() => Date.now() + challenge.resendInSeconds * 1000);
  const [resent, setResent] = useState(false);
  const wait = useCountdown(resendAt);
  const verify = usePending();
  const resend = usePending();

  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) return;
    void verify.run(async () => {
      const { accessToken } = await api<AccessToken>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ challengeId: challenge.challengeId, code, locale }),
      });
      await onSignedIn(accessToken);
    });
  };

  const sendAgain = () =>
    resend.run(async () => {
      const next = await api<OtpChallenge>('/auth/otp/resend', {
        method: 'POST',
        body: JSON.stringify({ challengeId: challenge.challengeId, locale }),
      });
      setResendAt(Date.now() + next.resendInSeconds * 1000);
      setCode('');
      setResent(true);
      verify.setError(undefined);
    });

  const failure = verify.error ?? resend.error;
  return (
    <form className="flow__form" onSubmit={submit} noValidate>
      <p>{t('signIn.codeIntro', { lastDigits })}</p>
      <OtpField
        label={t('signIn.codeLabel')}
        error={failure && t(failure)}
        value={code}
        onChange={(event) => {
          setCode(event.target.value.replace(/\D/g, ''));
        }}
      />
      {resent && !failure && <p role="status">{t('signIn.codeResent')}</p>}
      <div className="flow__links">
        {wait > 0 ? (
          <p className="flow__muted" aria-live="polite">
            {t('signIn.resendIn', { seconds: wait })}
          </p>
        ) : (
          <Button
            className="heach-button--link"
            onClick={() => void sendAgain()}
            disabled={resend.pending}
          >
            {t('signIn.resend')}
          </Button>
        )}
        <Button className="heach-button--link" onClick={onChangeNumber}>
          {t('signIn.changeNumber')}
        </Button>
      </div>
      <StepActions
        submitLabel={verify.pending ? t('signIn.verifying') : t('signIn.verify')}
        pending={verify.pending}
        disabled={code.length !== 6}
      />
    </form>
  );
}
