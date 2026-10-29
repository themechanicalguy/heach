'use client';

import { formatDateTime } from '@heach/i18n';
import { Button, Card, Notice, TextField } from '@heach/ui';
import type { Booking, Shift, VisitCode, VisitRecord } from '@heach/types';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { SafetyForm } from './SafetyForm';

const LIVE = new Set(['confirmed', 'in_progress']);

/** The patient's side of the visit (HS-03 to HS-06, RF-01, A12, BK-09). */
export function PatientVisitPanel({
  booking,
  onChanged,
}: Readonly<{ booking: Booking; onChanged: () => Promise<void> }>) {
  const { locale, t } = useI18n();
  const done = booking.status === 'completed';
  return (
    <>
      {LIVE.has(booking.status) && <ShowCode bookingId={booking.id} />}
      {booking.kind === 'shift' && LIVE.has(booking.status) && <Shifts bookingId={booking.id} />}
      {done && booking.kind !== 'shift' && <Notes bookingId={booking.id} />}
      {done && <RateForm bookingId={booking.id} />}
      {done && booking.provider && booking.listingId && (
        <Link
          className="heach-button heach-button--secondary"
          href={`/${locale}/providers/${booking.provider.id}?listing=${booking.listingId}`}
        >
          {t('visit.bookAgain')}
        </Link>
      )}
      {booking.status === 'confirmed' && (
        <ProviderAbsent bookingId={booking.id} onChanged={onChanged} />
      )}
      {booking.status !== 'pending_payment' && (
        <>
          <SafetyForm bookingId={booking.id} />
          <SafetyForm bookingId={booking.id} kind="complaint" />
        </>
      )}
    </>
  );
}

function ShowCode({ bookingId }: Readonly<{ bookingId: string }>) {
  const { t } = useI18n();
  const [code, setCode] = useState<VisitCode | undefined>();
  const { pending, error, run } = usePending();
  return (
    <Card title={t('visit.showCode')}>
      {code ? (
        <>
          <p className="visit-code">{t('visit.code', { code: code.code })}</p>
          <p className="flow__muted">{t('visit.codeHint')}</p>
        </>
      ) : (
        <Button
          onClick={() =>
            void run(async () => {
              setCode(await api<VisitCode>(`/bookings/${bookingId}/code`));
            })
          }
          disabled={pending}
        >
          {t('visit.showCode')}
        </Button>
      )}
      {error && (
        <Notice tone="info" live>
          {t(error)}
        </Notice>
      )}
    </Card>
  );
}

export function ShiftList({ shifts }: Readonly<{ shifts: readonly Shift[] }>) {
  const { locale, t } = useI18n();
  return (
    <ul>
      {shifts.map((shift) => (
        <li key={shift.dayIndex}>
          {t('visit.shift', {
            day: shift.dayIndex + 1,
            status: t(keyFor('visit.shiftStatus', shift.status, 'visit.shifts')),
          })}{' '}
          · {formatDateTime(new Date(shift.startsAt), locale)}
        </li>
      ))}
    </ul>
  );
}

function Shifts({ bookingId }: Readonly<{ bookingId: string }>) {
  const { t } = useI18n();
  const { resource } = useResource<Shift[]>(`/bookings/${bookingId}/shifts`);
  if (resource.state !== 'ready') return null;
  return (
    <Card title={t('visit.shifts')}>
      <ShiftList shifts={resource.data} />
    </Card>
  );
}

function Notes({ bookingId }: Readonly<{ bookingId: string }>) {
  const { t } = useI18n();
  const { resource } = useResource<VisitRecord | null>(`/bookings/${bookingId}/visit-notes`);
  if (resource.state !== 'ready' || !resource.data) return null;
  const notes = resource.data;
  return (
    <Card title={t('visit.notesTitle')}>
      <dl className="facts">
        <dt>{t('visit.procedure')}</dt>
        <dd>{notes.procedure}</dd>
        <dt>{t('visit.observations')}</dt>
        <dd>{notes.observations}</dd>
        <dt>{t('visit.advice')}</dt>
        <dd>{notes.advice}</dd>
      </dl>
    </Card>
  );
}

function RateForm({ bookingId }: Readonly<{ bookingId: string }>) {
  const { t } = useI18n();
  const [stars, setStars] = useState('5');
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const { pending, error, run } = usePending();
  if (done)
    return (
      <Notice tone="success" live>
        {t('visit.rated')}
      </Notice>
    );
  const send = () =>
    run(async () => {
      const body = { stars: Number(stars), ...(comment ? { comment } : {}) };
      await api(`/bookings/${bookingId}/review`, { method: 'POST', body: JSON.stringify(body) });
      setDone(true);
    });
  return (
    <Card title={t('visit.rateTitle')}>
      <TextField
        label={t('visit.stars')}
        type="number"
        min={1}
        max={5}
        value={stars}
        onChange={(event) => {
          setStars(event.currentTarget.value);
        }}
      />
      <TextField
        label={t('visit.comment')}
        multiline
        maxLength={500}
        value={comment}
        onChange={(event) => {
          setComment(event.currentTarget.value);
        }}
      />
      {error && (
        <Notice tone="info" live>
          {t(error)}
        </Notice>
      )}
      <Button onClick={() => void send()} disabled={pending}>
        {t('visit.rate')}
      </Button>
    </Card>
  );
}

function ProviderAbsent({
  bookingId,
  onChanged,
}: Readonly<{ bookingId: string; onChanged: () => Promise<void> }>) {
  const { t } = useI18n();
  const { pending, error, run } = usePending();
  return (
    <>
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
            await api(`/bookings/${bookingId}/provider-no-show`, { method: 'POST' });
            await onChanged();
          })
        }
      >
        {t('visit.providerAbsent')}
      </Button>
    </>
  );
}
