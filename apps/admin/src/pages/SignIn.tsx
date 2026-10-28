import { Button, Card, OtpField, TextField } from '@heach/ui';
import type { AccessToken, AdminPasswordAccepted } from '@heach/types';
import { useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useSession } from '../session';
import { usePending } from '../use-pending';

/** Email and password, then always a TOTP code; the first time, TOTP enrolment (AD-01). */
export function SignIn() {
  const [ticket, setTicket] = useState<AdminPasswordAccepted | undefined>();
  return (
    <main id="main" className="admin-sign-in">
      <Card title={ticket ? t('signIn.mfaTitle') : t('signIn.title')}>
        {ticket ? (
          <MfaStep
            ticket={ticket}
            onRestart={() => {
              setTicket(undefined);
            }}
          />
        ) : (
          <PasswordStep onAccepted={setTicket} />
        )}
      </Card>
    </main>
  );
}

function PasswordStep({
  onAccepted,
}: Readonly<{ onAccepted: (ticket: AdminPasswordAccepted) => void }>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { pending, error, run } = usePending();
  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    void run(async () => {
      onAccepted(
        await api<AdminPasswordAccepted>('/auth/password', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }),
      );
    });
  };
  return (
    <form className="admin-form" onSubmit={submit}>
      <TextField
        label={t('signIn.email')}
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
        }}
      />
      <TextField
        label={t('signIn.password')}
        type="password"
        autoComplete="current-password"
        required
        value={password}
        error={error !== undefined ? errorText(error) : undefined}
        onChange={(e) => {
          setPassword(e.target.value);
        }}
      />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? t('signIn.checking') : t('signIn.continue')}
      </Button>
    </form>
  );
}

function MfaStep({
  ticket,
  onRestart,
}: Readonly<{ ticket: AdminPasswordAccepted; onRestart: () => void }>) {
  const { signedIn } = useSession();
  const [code, setCode] = useState('');
  const { pending, error, run } = usePending();
  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    void run(async () => {
      const { accessToken } = await api<AccessToken>('/auth/mfa', {
        method: 'POST',
        body: JSON.stringify({ mfaTicket: ticket.mfaTicket, code }),
      });
      await signedIn(accessToken);
    });
  };
  return (
    <form className="admin-form" onSubmit={submit}>
      {ticket.enrolment ? (
        <section aria-labelledby="enrol-title">
          <h2 id="enrol-title">{t('signIn.enrolTitle')}</h2>
          <p>{t('signIn.enrolIntro')}</p>
          <p>
            {t('signIn.enrolKey')}: <code className="admin-secret">{ticket.enrolment.secret}</code>
          </p>
          <a href={ticket.enrolment.uri}>{t('signIn.enrolLink')}</a>
        </section>
      ) : (
        <p>{t('signIn.mfaIntro')}</p>
      )}
      <OtpField
        label={t('signIn.code')}
        value={code}
        error={error !== undefined ? errorText(error) : undefined}
        onChange={(e) => {
          setCode(e.target.value.replace(/\D/g, ''));
        }}
      />
      <div className="admin-actions">
        <Button type="submit" disabled={pending || code.length !== 6} aria-busy={pending}>
          {t('signIn.verify')}
        </Button>
        <Button className="heach-button--ghost" onClick={onRestart}>
          {t('signIn.restart')}
        </Button>
      </div>
    </form>
  );
}
