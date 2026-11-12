import { normalizeDigits, type Locale } from '@heach/i18n';
import { Button, ChoiceGroup, Notice, OtpField, TextField } from '@heach/ui';
import type { AssistedChallenge, AssistedSession } from '@heach/types';
import { useState } from 'react';
import { api } from '../api';
import { t } from '../i18n';
import { useAssistedCall, type SessionHandler } from '../use-assisted-call';
import { useCountdown } from '../use-countdown';
import { ErrorNotice } from './AssistedParts';

const LOCALE_CHOICES: Locale[] = ['or', 'en', 'hi'];

interface RequestProps {
  onChallenge: (challenge: AssistedChallenge) => void;
}

/** Asks for the provider's number; sending the code needs a fresh authenticator code (L-11). */
function ConsentRequest({ onChallenge }: Readonly<RequestProps>) {
  const [mobile, setMobile] = useState('');
  const [locale, setLocale] = useState<Locale>('or');
  const { pending, error, otherSensitive, sheet } = useAssistedCall(() => undefined);
  const send = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    void otherSensitive(async () => {
      onChallenge(
        await api<AssistedChallenge>('/assisted-onboarding/consent', {
          method: 'POST',
          body: JSON.stringify({ mobile, locale }),
        }),
      );
    });
  };
  return (
    <>
      <form className="admin-form" onSubmit={send}>
        <TextField
          label={t('assisted.mobile')}
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          value={mobile}
          onChange={(event) => {
            setMobile(normalizeDigits(event.currentTarget.value));
          }}
        />
        <ChoiceGroup
          legend={t('assisted.locale')}
          name="assisted-locale"
          value={locale}
          choices={LOCALE_CHOICES.map((value) => ({
            value,
            label: t(`assisted.locales.${value}`),
          }))}
          onChange={(value) => {
            setLocale(value as Locale);
          }}
        />
        <ErrorNotice error={error} />
        <Button type="submit" disabled={pending || mobile.trim() === ''}>
          {t('assisted.sendCode')}
        </Button>
      </form>
      {sheet}
    </>
  );
}

interface CodeProps {
  challenge: AssistedChallenge;
  onChallenge: (challenge: AssistedChallenge) => void;
  onSession: SessionHandler;
}

/** The code the provider reads out opens the session (AD-12). */
function ConsentCode({ challenge, onChallenge, onSession }: Readonly<CodeProps>) {
  const [code, setCode] = useState('');
  const countdown = useCountdown(challenge.resendInSeconds);
  const { pending, error, call, other } = useAssistedCall(onSession);
  const base = `/assisted-onboarding/sessions/${challenge.sessionId}/consent`;
  const verify = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    void call(() =>
      api<AssistedSession>(`${base}/verify`, { method: 'POST', body: JSON.stringify({ code }) }),
    );
  };
  const resend = () =>
    other(async () => {
      const next = await api<AssistedChallenge>(`${base}/resend`, { method: 'POST' });
      countdown.restart(next.resendInSeconds);
      onChallenge(next);
    });
  return (
    <form className="admin-form" onSubmit={verify}>
      <Notice tone="info" live>
        {t('assisted.codeSent', { mobile: challenge.mobile })}
      </Notice>
      <OtpField
        label={t('assisted.code')}
        value={code}
        onChange={(event) => {
          setCode(normalizeDigits(event.target.value).replace(/\D/g, ''));
        }}
      />
      <ErrorNotice error={error} />
      <div className="admin-actions">
        <Button type="submit" disabled={pending || code.length !== 6}>
          {t('assisted.verify')}
        </Button>
        <Button
          className="heach-button--secondary"
          onClick={() => void resend()}
          disabled={pending || countdown.seconds > 0}
        >
          {t('assisted.resend')}
        </Button>
        {countdown.seconds > 0 && (
          <span>{t('assisted.resendIn', { seconds: countdown.seconds })}</span>
        )}
      </div>
    </form>
  );
}

/** Step 1: the provider's number, then the code they read out as consent. */
export function AssistedConsent({ onSession }: Readonly<{ onSession: SessionHandler }>) {
  const [challenge, setChallenge] = useState<AssistedChallenge | undefined>();
  if (!challenge) return <ConsentRequest onChallenge={setChallenge} />;
  return <ConsentCode challenge={challenge} onChallenge={setChallenge} onSession={onSession} />;
}
