'use client';

import { formatDateTime } from '@heach/i18n';
import { Button, Card, ChoiceGroup, Notice, TextField } from '@heach/ui';
import type { Booking, LinkedPatient } from '@heach/types';
import { useState } from 'react';
import { api, UPLOAD_CONTENT_TYPE } from '../../lib/api';
import { readAsBase64 } from '../../lib/files';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { BookingReview } from './BookingReview';

export type BookingTarget =
  { kind: 'chosen'; listingId: string } | { kind: 'any'; itemCode: string; pin: string };

export interface ItemFacts {
  itemName: string;
  kind: 'visit' | 'shift' | 'lab_test';
  prescriptionRequired: boolean;
}

interface Props {
  target: BookingTarget;
  facts: ItemFacts;
  startsAt: string;
}

/** The booking details (BK-01, BK-05): who it is for, where, notes, prescription, days. */
export function BookingForm({ target, facts, startsAt }: Readonly<Props>) {
  const { locale, t } = useI18n();
  const people = useResource<LinkedPatient[]>('/me/linked-patients');
  const [form, setForm] = useState<FormState>({
    recipient: '',
    address: '',
    pin: target.kind === 'any' ? target.pin : '',
    notes: '',
    days: '1',
    gender: '',
  });
  const [file, setFile] = useState<File | undefined>();
  const [booking, setBooking] = useState<Booking | undefined>();
  const { pending, error, run } = usePending();
  if (booking) return <BookingReview booking={booking} />;

  const set = (key: keyof FormState) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const submit = () =>
    run(async () => {
      const body = {
        ...(target.kind === 'chosen'
          ? { listingId: target.listingId }
          : { itemCode: target.itemCode }),
        startsAt,
        pin: form.pin,
        address: form.address,
        locale,
        ...(form.notes ? { notes: form.notes } : {}),
        ...(form.recipient ? { recipientId: form.recipient } : {}),
        ...(form.gender ? { genderPreference: form.gender } : {}),
        ...(facts.kind === 'shift' ? { shiftDays: Number(form.days) } : {}),
        ...(file
          ? { prescription: { contentType: file.type, contentBase64: await readAsBase64(file) } }
          : {}),
      };
      setBooking(
        await api<Booking>('/bookings', {
          method: 'POST',
          headers: { 'content-type': UPLOAD_CONTENT_TYPE },
          body: JSON.stringify(body),
        }),
      );
    });
  const linked = people.resource.state === 'ready' ? people.resource.data : [];

  return (
    <Card title={facts.itemName}>
      <p>
        {t('book.when')}: <strong>{formatDateTime(new Date(startsAt), locale)}</strong>
      </p>
      <form
        className="flow__form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <BookingFields
          form={form}
          set={set}
          target={target}
          facts={facts}
          linked={linked}
          onFile={setFile}
        />
        {error && (
          <Notice tone="danger" live>
            {t(error)}
          </Notice>
        )}
        <Button type="submit" disabled={pending}>
          {t('book.continue')}
        </Button>
      </form>
    </Card>
  );
}

type FormState = Record<'recipient' | 'address' | 'pin' | 'notes' | 'days' | 'gender', string>;

interface FieldsProps {
  form: FormState;
  set: (key: keyof FormState) => (value: string) => void;
  target: BookingTarget;
  facts: ItemFacts;
  linked: readonly LinkedPatient[];
  onFile: (file: File | undefined) => void;
}

function BookingFields({ form, set, target, facts, linked, onFile }: Readonly<FieldsProps>) {
  const { t } = useI18n();
  return (
    <>
      <ChoiceGroup
        legend={t('book.who')}
        name="recipient"
        value={form.recipient}
        choices={[
          { value: '', label: t('book.myself') },
          ...linked.map((person) => ({ value: person.id, label: person.fullName })),
        ]}
        onChange={set('recipient')}
      />
      <TextField
        label={t('book.address')}
        hint={t('book.addressHint')}
        multiline
        required
        value={form.address}
        onChange={(event) => {
          set('address')(event.currentTarget.value);
        }}
      />
      {target.kind === 'chosen' && (
        <TextField
          label={t('book.pin')}
          inputMode="numeric"
          maxLength={6}
          required
          value={form.pin}
          onChange={(event) => {
            set('pin')(event.currentTarget.value.trim());
          }}
        />
      )}
      <TextField
        label={t('book.notes')}
        hint={t('book.notesHint')}
        multiline
        maxLength={500}
        value={form.notes}
        onChange={(event) => {
          set('notes')(event.currentTarget.value);
        }}
      />
      {facts.kind === 'shift' && (
        <TextField
          label={t('book.days')}
          type="number"
          min={1}
          max={30}
          value={form.days}
          onChange={(event) => {
            set('days')(event.currentTarget.value);
          }}
        />
      )}
      {target.kind === 'any' && (
        <ChoiceGroup
          legend={t('book.gender')}
          name="gender"
          value={form.gender}
          choices={[
            { value: '', label: t('book.anyGender') },
            { value: 'female', label: t('search.genderFemale') },
            { value: 'male', label: t('search.genderMale') },
          ]}
          onChange={set('gender')}
        />
      )}
      {facts.prescriptionRequired && (
        <TextField
          label={t('book.prescription')}
          hint={t('book.prescriptionHint')}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          capture="environment"
          onChange={(event) => {
            onFile(event.currentTarget.files?.[0]);
          }}
        />
      )}
    </>
  );
}
