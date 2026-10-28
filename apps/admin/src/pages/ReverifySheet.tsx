import { Button, OtpField, Sheet } from '@heach/ui';
import { useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { usePending } from '../use-pending';

interface Props {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
}

/** A fresh TOTP code before a sensitive action (decision L-11). */
export function ReverifySheet({ open, onClose, onVerified }: Readonly<Props>) {
  const [code, setCode] = useState('');
  const { pending, error, run } = usePending();
  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    void run(async () => {
      await api('/auth/reverify', { method: 'POST', body: JSON.stringify({ code }) });
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
      <form className="admin-form" onSubmit={submit}>
        <p>{t('reverify.intro')}</p>
        <OtpField
          label={t('signIn.code')}
          value={code}
          error={error !== undefined ? errorText(error) : undefined}
          onChange={(event) => {
            setCode(event.target.value.replace(/\D/g, ''));
          }}
        />
        <Button type="submit" disabled={pending || code.length !== 6}>
          {t('reverify.confirm')}
        </Button>
      </form>
    </Sheet>
  );
}
