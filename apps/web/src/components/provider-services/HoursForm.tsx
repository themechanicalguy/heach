'use client';

import { formatDate } from '@heach/i18n';
import { Button, Card, CheckboxField, Notice, TextField } from '@heach/ui';
import type { Availability } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { type DayHours, daysFromRules, rulesFromDays } from './hours';

interface Props {
  availability: Availability;
  onSaved: (availability: Availability) => void;
}

/** Weekly hours and the gap between visits (AV-01, AV-03). Times are IST (AV-04). */
export function HoursForm({ availability, onSaved }: Readonly<Props>) {
  const { t } = useI18n();
  const [days, setDays] = useState<DayHours[]>(daysFromRules(availability.rules));
  const [buffer, setBuffer] = useState(String(availability.bufferMinutes));
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = usePending();
  const change = (index: number, patch: Partial<DayHours>) => {
    setDays((current) => current.map((day, at) => (at === index ? { ...day, ...patch } : day)));
    setSaved(false);
  };
  const save = () =>
    run(async () => {
      const body = { rules: rulesFromDays(days), bufferMinutes: Number(buffer) };
      onSaved(
        await api<Availability>('/provider/availability', {
          method: 'PUT',
          body: JSON.stringify(body),
        }),
      );
      setSaved(true);
    });
  return (
    <Card title={t('providerServices.hours')}>
      {days.map((day, index) => {
        const name = t(`weekdays.${String(index) as '0'}`);
        return (
          <fieldset key={name} className="hours-row">
            <legend>{name}</legend>
            <CheckboxField
              label={t('providerServices.offered')}
              checked={day.open}
              onChange={(event) => {
                change(index, { open: event.currentTarget.checked });
              }}
            />
            {day.open && (
              <>
                <TextField
                  label={t('providerServices.from')}
                  type="time"
                  value={day.from}
                  onChange={(event) => {
                    change(index, { from: event.currentTarget.value });
                  }}
                />
                <TextField
                  label={t('providerServices.to')}
                  type="time"
                  value={day.to === '24:00' ? '00:00' : day.to}
                  onChange={(event) => {
                    change(index, { to: event.currentTarget.value });
                  }}
                />
              </>
            )}
          </fieldset>
        );
      })}
      <TextField
        label={t('providerServices.buffer')}
        inputMode="numeric"
        value={buffer}
        onChange={(event) => {
          setBuffer(event.currentTarget.value);
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      {saved && (
        <Notice tone="success" live>
          {t('providerServices.saved')}
        </Notice>
      )}
      <Button onClick={() => void save()} disabled={pending}>
        {t('providerServices.saveHours')}
      </Button>
    </Card>
  );
}

/** Leave days (AV-01): whole IST days from the first to the last. */
export function LeaveForm({
  availability,
  onChanged,
}: Readonly<{ availability: Availability; onChanged: () => Promise<void> }>) {
  const { locale, t } = useI18n();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { pending, error, run } = usePending();
  const add = () =>
    run(async () => {
      const start = new Date(`${from}T00:00:00+05:30`);
      const end = new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 86_400_000);
      await api('/provider/availability/blocks', {
        method: 'POST',
        body: JSON.stringify({ start, end }),
      });
      setFrom('');
      setTo('');
      await onChanged();
    });
  const remove = (id: string) =>
    run(async () => {
      await api(`/provider/availability/blocks/${id}`, { method: 'DELETE' });
      await onChanged();
    });
  return (
    <Card title={t('providerServices.leave')}>
      {availability.blocks.length === 0 ? (
        <p className="flow__muted">{t('providerServices.noLeave')}</p>
      ) : (
        <ul>
          {availability.blocks.map((block) => (
            <li key={block.id}>
              {formatDate(new Date(block.start), locale)} –{' '}
              {formatDate(new Date(new Date(block.end).getTime() - 1), locale)}{' '}
              <Button
                className="heach-button--secondary"
                onClick={() => void remove(block.id)}
                disabled={pending}
              >
                {t('providerServices.removeLeave')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <TextField
        label={t('providerServices.leaveFrom')}
        type="date"
        value={from}
        onChange={(event) => {
          setFrom(event.currentTarget.value);
        }}
      />
      <TextField
        label={t('providerServices.leaveTo')}
        type="date"
        value={to}
        onChange={(event) => {
          setTo(event.currentTarget.value);
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      <Button onClick={() => void add()} disabled={pending || !from || !to}>
        {t('providerServices.addLeave')}
      </Button>
    </Card>
  );
}
