'use client';

import { Button, Card, Notice, TextField } from '@heach/ui';
import type { BookingPolicy, ProviderBooking, Shift } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { ShiftList } from './PatientVisitPanel';
import { SafetyForm } from './SafetyForm';

type Refresh = () => Promise<void>;

/** The provider's side of the visit (HS-02 to HS-06, A15). */
export function ProviderVisitPanel({
  booking,
  onChanged,
}: Readonly<{ booking: ProviderBooking; onChanged: Refresh }>) {
  const { t } = useI18n();
  const shift = booking.kind === 'shift';
  return (
    <>
      {booking.address && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.address)}`}
          target="_blank"
          rel="noreferrer"
        >
          {t('visit.map')}
        </a>
      )}
      {!shift && booking.status === 'confirmed' && (
        <StartVisit bookingId={booking.id} onChanged={onChanged} />
      )}
      {!shift && booking.status === 'in_progress' && (
        <CompleteVisit bookingId={booking.id} onChanged={onChanged} />
      )}
      {shift && ['confirmed', 'in_progress'].includes(booking.status) && (
        <ShiftChecks bookingId={booking.id} onChanged={onChanged} />
      )}
      {booking.status === 'confirmed' && (
        <PatientAbsent bookingId={booking.id} onChanged={onChanged} />
      )}
      {booking.status !== 'pending_payment' && <SafetyForm bookingId={booking.id} />}
    </>
  );
}

function CodeAction({
  label,
  path,
  onChanged,
}: Readonly<{ label: string; path: string; onChanged: Refresh }>) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const { pending, error, run } = usePending();
  return (
    <div className="flow__form">
      <TextField
        label={t('visit.enterCode')}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(event) => {
          setCode(event.currentTarget.value.trim());
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      <Button
        disabled={pending || code.length !== 6}
        onClick={() =>
          void run(async () => {
            await api(path, { method: 'POST', body: JSON.stringify({ code }) });
            await onChanged();
          })
        }
      >
        {label}
      </Button>
    </div>
  );
}

function StartVisit({ bookingId, onChanged }: Readonly<{ bookingId: string; onChanged: Refresh }>) {
  const { t } = useI18n();
  return (
    <CodeAction
      label={t('visit.start')}
      path={`/provider/bookings/${bookingId}/start`}
      onChanged={onChanged}
    />
  );
}

function CompleteVisit({
  bookingId,
  onChanged,
}: Readonly<{ bookingId: string; onChanged: Refresh }>) {
  const { t } = useI18n();
  const [notes, setNotes] = useState({ procedure: '', observations: '', advice: '' });
  const { pending, error, run } = usePending();
  const field = (key: keyof typeof notes) => (
    <TextField
      label={t(`visit.${key}`)}
      multiline
      maxLength={1000}
      required
      value={notes[key]}
      onChange={(event) => {
        const value = event.currentTarget.value;
        setNotes((current) => ({ ...current, [key]: value }));
      }}
    />
  );
  return (
    <Card title={t('visit.notesTitle')}>
      {field('procedure')}
      {field('observations')}
      {field('advice')}
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      <Button
        disabled={pending || !notes.procedure || !notes.observations || !notes.advice}
        onClick={() =>
          void run(async () => {
            await api(`/provider/bookings/${bookingId}/complete`, {
              method: 'POST',
              body: JSON.stringify(notes),
            });
            await onChanged();
          })
        }
      >
        {t('visit.complete')}
      </Button>
    </Card>
  );
}

function ShiftChecks({
  bookingId,
  onChanged,
}: Readonly<{ bookingId: string; onChanged: Refresh }>) {
  const { t } = useI18n();
  const { resource, reload } = useResource<Shift[]>(`/provider/bookings/${bookingId}/shifts`);
  if (resource.state !== 'ready') return null;
  const open = resource.data.find((shift) => shift.status === 'checked_in');
  const next = resource.data.find((shift) => shift.status === 'scheduled');
  const target = open ?? next;
  const refresh = async () => {
    await reload();
    await onChanged();
  };
  return (
    <Card title={t('visit.shifts')}>
      <ShiftList shifts={resource.data} />
      {target && (
        <CodeAction
          label={open ? t('visit.checkOut') : t('visit.checkIn')}
          path={`/provider/bookings/${bookingId}/shifts/${String(target.dayIndex)}/${open ? 'check-out' : 'check-in'}`}
          onChanged={refresh}
        />
      )}
    </Card>
  );
}

function PatientAbsent({
  bookingId,
  onChanged,
}: Readonly<{ bookingId: string; onChanged: Refresh }>) {
  const { t } = useI18n();
  const policy = useResource<BookingPolicy>('/booking-policy');
  const { pending, error, run } = usePending();
  const minutes = policy.resource.state === 'ready' ? policy.resource.data.noShowWaitMinutes : 15;
  return (
    <>
      <p className="flow__muted">{t('visit.patientAbsentHint', { minutes })}</p>
      {error && (
        <Notice tone="info" live>
          {t(error)}
        </Notice>
      )}
      <Button
        className="heach-button--secondary"
        disabled={pending}
        onClick={() =>
          void run(async () => {
            await api(`/provider/bookings/${bookingId}/no-show`, { method: 'POST' });
            await onChanged();
          })
        }
      >
        {t('visit.patientAbsent')}
      </Button>
    </>
  );
}
