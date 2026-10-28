'use client';

import { Button, TextField } from '@heach/ui';
import type { OtpChallenge } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';

/** Ten digits starting 6 to 9, optionally with +91 or 0 (the API applies the same rule). */
const INDIAN_MOBILE = /^(?:\+91|91|0)?[6-9]\d{9}$/;

export function MobileStep({
  onSent,
}: Readonly<{ onSent: (challenge: OtpChallenge, lastDigits: string) => void }>) {
  const { locale, t } = useI18n();
  const [mobile, setMobile] = useState('');
  const [touched, setTouched] = useState(false);
  const { pending, error, run } = usePending();
  const compact = mobile.replace(/[\s().-]/g, '');
  const invalid = !INDIAN_MOBILE.test(compact);

  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setTouched(true);
    if (invalid) return;
    void run(async () => {
      const challenge = await api<OtpChallenge>('/auth/otp', {
        method: 'POST',
        body: JSON.stringify({ mobile: compact, locale }),
      });
      onSent(challenge, compact.slice(-4));
    });
  };

  return (
    <form className="flow__form" onSubmit={submit} noValidate>
      <TextField
        label={t('signIn.mobileLabel')}
        hint={t('signIn.mobileHint')}
        error={touched && invalid ? t('errors.mobile_invalid') : error && t(error)}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={16}
        value={mobile}
        onChange={(event) => {
          setMobile(event.target.value);
        }}
      />
      <div className="flow__actions">
        <Button type="submit" className="flow__primary" disabled={pending} aria-busy={pending}>
          {pending ? t('signIn.sending') : t('signIn.sendCode')}
        </Button>
      </div>
    </form>
  );
}
