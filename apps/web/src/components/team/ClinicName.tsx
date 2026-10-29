'use client';

import { Button, Notice, TextField } from '@heach/ui';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';

/** A clinic is named before it invites staff; the name can be corrected later. */
export function ClinicName({
  name,
  onSaved,
}: Readonly<{ name: string | null; onSaved: () => Promise<void> }>) {
  const { t } = useI18n();
  const [value, setValue] = useState(name ?? '');
  const [editing, setEditing] = useState(name === null);
  const { pending, error, run } = usePending();
  if (!editing) {
    return (
      <Button
        className="heach-button--link"
        onClick={() => {
          setEditing(true);
        }}
      >
        {t('team.renameClinic')}
      </Button>
    );
  }
  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    void run(async () => {
      await api('/organisation/name', {
        method: 'PUT',
        body: JSON.stringify({ name: value.trim() }),
      });
      setEditing(false);
      await onSaved();
    });
  };
  return (
    <form className="flow__form" onSubmit={submit} noValidate>
      <TextField
        label={t('team.clinicName')}
        hint={t('team.clinicNameHint')}
        maxLength={120}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      <Button type="submit" disabled={pending || value.trim() === ''} aria-busy={pending}>
        {t('profile.save')}
      </Button>
    </form>
  );
}
