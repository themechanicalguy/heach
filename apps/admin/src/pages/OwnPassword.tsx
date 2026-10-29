import { Button, Notice, TextField } from '@heach/ui';
import { useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { usePending } from '../use-pending';
import { useReverified } from '../use-reverified';

/** An admin changes their own password: the current one, a fresh TOTP, and other devices end (O-2). */
export function OwnPassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [changed, setChanged] = useState(false);
  const { pending, error, run } = usePending();
  const { attempt, sheet } = useReverified(run);
  const mismatch = repeat !== '' && repeat !== next;
  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (mismatch) return;
    setChanged(false);
    void attempt(async () => {
      const body = JSON.stringify({ currentPassword: current, newPassword: next });
      await api('/auth/password/change', { method: 'POST', body });
      setCurrent('');
      setNext('');
      setRepeat('');
      setChanged(true);
    });
  };
  return (
    <section aria-labelledby="password-title" className="admin-page">
      <h1 id="password-title">{t('password.title')}</h1>
      <form className="admin-form" onSubmit={submit}>
        <TextField
          label={t('password.current')}
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(event) => {
            setCurrent(event.target.value);
          }}
        />
        <NewPasswordFields next={next} repeat={repeat} onNext={setNext} onRepeat={setRepeat} />
        {error !== undefined && (
          <Notice tone="danger" live>
            {errorText(error)}
          </Notice>
        )}
        {changed && (
          <Notice tone="success" live>
            {t('password.changed')}
          </Notice>
        )}
        <Button type="submit" disabled={pending || mismatch || next === ''} aria-busy={pending}>
          {t('password.change')}
        </Button>
        {sheet}
      </form>
    </section>
  );
}

interface NewFieldsProps {
  next: string;
  repeat: string;
  onNext: (value: string) => void;
  onRepeat: (value: string) => void;
}

/** A new password typed twice; also used at the first sign-in after a reset. */
export function NewPasswordFields({ next, repeat, onNext, onRepeat }: Readonly<NewFieldsProps>) {
  return (
    <>
      <TextField
        label={t('password.new')}
        hint={t('password.rules')}
        type="password"
        autoComplete="new-password"
        required
        value={next}
        onChange={(event) => {
          onNext(event.target.value);
        }}
      />
      <TextField
        label={t('password.repeat')}
        type="password"
        autoComplete="new-password"
        required
        value={repeat}
        error={repeat !== '' && repeat !== next ? t('password.mismatch') : undefined}
        onChange={(event) => {
          onRepeat(event.target.value);
        }}
      />
    </>
  );
}
