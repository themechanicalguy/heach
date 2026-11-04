'use client';

import { Button, ChoiceGroup, Notice } from '@heach/ui';
import type { LinkCreated, VaultRecord } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';

/** Within the server's 1 to 72 hour limit for links (MV-09). */
const LINK_HOURS = [24, 48, 72] as const;

/** A link for a doctor outside HEACH (MV-09): the link and code are shown once. */
export function LinkForm({
  records,
  initial,
}: Readonly<{ records: readonly VaultRecord[]; initial: readonly string[] }>) {
  const { locale, t } = useI18n();
  const [chosen, setChosen] = useState<string[]>([...initial]);
  const [hours, setHours] = useState('24');
  const [created, setCreated] = useState<LinkCreated | undefined>();
  const { pending, error, run } = usePending();
  if (records.length === 0) return null;
  return (
    <div className="flow__form">
      <RecordPicker records={records} chosen={chosen} onChange={setChosen} />
      <ChoiceGroup
        legend={t('vault.linkHours')}
        variant="chips"
        name="link-hours"
        value={hours}
        choices={LINK_HOURS.map((value) => ({
          value: String(value),
          label: t('vault.hoursOption', { hours: value }),
        }))}
        onChange={setHours}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      {created ? (
        <Notice tone="success" live>
          {t('vault.linkCreated')} {`${window.location.origin}/${locale}/shared/${created.token}`} ·{' '}
          {t('vault.linkCode', { code: created.code })}
        </Notice>
      ) : (
        <Button
          disabled={pending || chosen.length === 0}
          onClick={() =>
            void run(async () => {
              setCreated(
                await api<LinkCreated>('/vault/links', {
                  method: 'POST',
                  body: JSON.stringify({ recordIds: chosen, hours: Number(hours) }),
                }),
              );
            })
          }
        >
          {t('vault.createLink')}
        </Button>
      )}
    </div>
  );
}

export function RecordPicker({
  records,
  chosen,
  onChange,
}: Readonly<{
  records: readonly VaultRecord[];
  chosen: readonly string[];
  onChange: (ids: string[]) => void;
}>) {
  return (
    <fieldset>
      {records.map((record) => (
        <label key={record.id} className="heach-checkbox">
          <input
            type="checkbox"
            checked={chosen.includes(record.id)}
            onChange={(event) => {
              const checked = event.currentTarget.checked;
              onChange(checked ? [...chosen, record.id] : chosen.filter((id) => id !== record.id));
            }}
          />
          <span>{record.title}</span>
        </label>
      ))}
    </fieldset>
  );
}
