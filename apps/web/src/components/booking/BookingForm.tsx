'use client';

import { formatDateTime, normalizeDigits } from '@heach/i18n';
import { Button, CheckboxField, ChoiceGroup, Notice, TextField } from '@heach/ui';
import type { Booking, LinkedPatient, ProfileListing } from '@heach/types';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { api, UPLOAD_CONTENT_TYPE } from '../../lib/api';
import { readAsBase64 } from '../../lib/files';
import { useCareSearch } from '../../lib/care-search';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { BookingReceipt } from './BookingReceipt';
import { BookingReview } from './BookingReview';
import { money } from './money';
import { PaymentOptions } from './PaymentOptions';

export type BookingTarget =
  { kind: 'chosen'; listingId: string } | { kind: 'any'; itemCode: string; pin: string };

export interface ItemFacts {
  itemName: string;
  kind: 'visit' | 'shift' | 'lab_test';
  prescriptionRequired: boolean;
  feePaise?: number;
}

interface Props {
  target: BookingTarget;
  facts: ItemFacts;
  /** The chosen time; empty until one is picked in `schedule`. */
  startsAt: string;
  /** The day and time picker, shown as the first section (G07). */
  schedule: ReactNode;
  providerName?: string | undefined;
  /** Other tests of the same lab that can join this booking (LB-03). */
  labTests?: readonly ProfileListing[];
}

/** The booking details (BK-01, BK-05): who it is for, where, notes, prescription, days. */
/** The form's values and the people it can be for; who follows the header's person picker. */
function useBookingFields(target: BookingTarget) {
  const { person, search, setPerson } = useCareSearch();
  const [form, setForm] = useState<FormState>({
    recipient: person,
    address: '',
    pin: target.kind === 'any' ? target.pin : search.pin,
    notes: '',
    days: '1',
    gender: '',
    collection: 'home',
    purchaseId: '',
    couponId: '',
  });
  useEffect(() => {
    setForm((current) => ({ ...current, recipient: person }));
  }, [person]);
  const set = (key: keyof FormState) => (value: string) => {
    if (key === 'recipient') setPerson(value);
    setForm((current) => ({ ...current, [key]: value }));
  };
  const people = useResource<LinkedPatient[]>('/me/linked-patients');
  const linked = people.resource.state === 'ready' ? people.resource.data : [];
  return { form, set, linked };
}

export function BookingForm({
  target,
  facts,
  startsAt,
  schedule,
  providerName,
  labTests = [],
}: Readonly<Props>) {
  const { locale, t } = useI18n();
  const { form, set, linked } = useBookingFields(target);
  const [file, setFile] = useState<File | undefined>();
  const [extras, setExtras] = useState<string[]>([]);
  const [booking, setBooking] = useState<Booking | undefined>();
  const { pending, error, run } = usePending();
  const formId = useId();
  if (booking)
    return <BookingReview booking={booking} providerName={providerName} startsAt={startsAt} />;

  const submit = () =>
    run(async () => {
      const body = await bookingBody({ target, facts, startsAt, locale, form, extras, file });
      setBooking(
        await api<Booking>('/bookings', {
          method: 'POST',
          headers: { 'content-type': UPLOAD_CONTENT_TYPE },
          body: JSON.stringify(body),
        }),
      );
    });

  const upTo = target.kind === 'any';
  const needsPrescription =
    facts.prescriptionRequired ||
    labTests.some((test) => extras.includes(test.listingId) && test.prescriptionRequired);
  const continueButton = (
    <Button type="submit" form={formId} disabled={pending || !startsAt}>
      {t('book.continue')}
    </Button>
  );
  return (
    <div className="booking">
      <div className="booking__main">
        <BookingSection step={1} title={t('book.stepWhen')}>
          {schedule}
        </BookingSection>
        <BookingSection step={2} title={t('book.stepDetails')}>
          <form
            id={formId}
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
              needsPrescription={needsPrescription}
            />
            {facts.kind === 'lab_test' && (
              <LabChoices
                form={form}
                set={set}
                labTests={labTests}
                extras={extras}
                onExtras={setExtras}
              />
            )}
            <PaymentOptions
              purchaseId={form.purchaseId}
              couponId={form.couponId}
              onPurchase={set('purchaseId')}
              onCoupon={set('couponId')}
            />
            {error && (
              <Notice tone="danger" live>
                {t(error)}
              </Notice>
            )}
          </form>
        </BookingSection>
      </div>
      <BookingReceipt
        providerName={providerName}
        itemName={facts.itemName}
        startsAt={startsAt}
        feePaise={facts.feePaise}
        upTo={upTo}
      >
        <div className="receipt__action">{continueButton}</div>
      </BookingReceipt>
      <BookingBar startsAt={startsAt} feePaise={facts.feePaise} upTo={upTo}>
        {continueButton}
      </BookingBar>
    </div>
  );
}

/** Phones and tablets: the chosen time, the fee and Continue above the navigation (G08). */
function BookingBar({
  startsAt,
  feePaise,
  upTo,
  children,
}: Readonly<{
  startsAt: string;
  feePaise?: number | undefined;
  upTo: boolean;
  children: ReactNode;
}>) {
  const { locale, t } = useI18n();
  return (
    <div className="booking-bar">
      <p className="booking-bar__summary">
        <strong>
          {startsAt ? formatDateTime(new Date(startsAt), locale) : t('book.selectTime')}
        </strong>
        {feePaise !== undefined && (
          <span>
            {upTo
              ? t('book.anyFeeLine', { fee: money(feePaise) })
              : t('book.feeLine', { fee: money(feePaise) })}
          </span>
        )}
      </p>
      {children}
    </div>
  );
}

/** A numbered section of the booking page (desktop booking board). */
function BookingSection({
  step,
  title,
  children,
}: Readonly<{ step: number; title: string; children: ReactNode }>) {
  const id = useId();
  return (
    <section className="booking__section" aria-labelledby={id}>
      <h2 id={id} className="booking__section-title">
        <span className="booking__step" aria-hidden="true">
          {String(step)}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

interface BodyInput {
  target: BookingTarget;
  facts: ItemFacts;
  startsAt: string;
  locale: string;
  form: FormState;
  extras: readonly string[];
  file: File | undefined;
}

/** The booking request: only the fields that apply to this service and were filled in. */
async function bookingBody({ target, facts, startsAt, locale, form, extras, file }: BodyInput) {
  return {
    ...(target.kind === 'chosen' ? { listingId: target.listingId } : { itemCode: target.itemCode }),
    startsAt,
    pin: form.pin,
    address: form.address,
    locale,
    ...(form.notes ? { notes: form.notes } : {}),
    ...(form.recipient ? { recipientId: form.recipient } : {}),
    ...(form.gender ? { genderPreference: form.gender } : {}),
    ...(form.purchaseId ? { purchaseId: form.purchaseId } : {}),
    ...(form.couponId ? { couponId: form.couponId } : {}),
    ...(facts.kind === 'shift' ? { shiftDays: Number(form.days) } : {}),
    ...(facts.kind === 'lab_test' ? { collection: form.collection, extraListingIds: extras } : {}),
    ...(file
      ? { prescription: { contentType: file.type, contentBase64: await readAsBase64(file) } }
      : {}),
  };
}

type FormState = Record<
  | 'recipient'
  | 'address'
  | 'pin'
  | 'notes'
  | 'days'
  | 'gender'
  | 'collection'
  | 'purchaseId'
  | 'couponId',
  string
>;

interface FieldsProps {
  form: FormState;
  set: (key: keyof FormState) => (value: string) => void;
  target: BookingTarget;
  facts: ItemFacts;
  linked: readonly LinkedPatient[];
  onFile: (file: File | undefined) => void;
  needsPrescription: boolean;
}

function BookingFields({
  form,
  set,
  target,
  facts,
  linked,
  onFile,
  needsPrescription,
}: Readonly<FieldsProps>) {
  const { t } = useI18n();
  return (
    <>
      <ChoiceGroup
        legend={t('book.who')}
        variant="chips"
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
            set('pin')(normalizeDigits(event.currentTarget.value.trim()));
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
          variant="chips"
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
      {needsPrescription && (
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

interface LabProps {
  form: FormState;
  set: (key: keyof FormState) => (value: string) => void;
  labTests: readonly ProfileListing[];
  extras: readonly string[];
  onExtras: (extras: string[]) => void;
}

/** Home collection or walk-in (LB-02), and more tests from the same lab in one booking (LB-03). */
function LabChoices({ form, set, labTests, extras, onExtras }: Readonly<LabProps>) {
  const { t } = useI18n();
  return (
    <>
      <ChoiceGroup
        legend={t('lab.collection')}
        variant="chips"
        name="collection"
        value={form.collection}
        choices={[
          { value: 'home', label: t('lab.home') },
          { value: 'walk_in', label: t('lab.walkIn') },
        ]}
        onChange={set('collection')}
      />
      {labTests.length > 0 && (
        <fieldset>
          <legend>{t('lab.cart')}</legend>
          {labTests.map((test) => (
            <CheckboxField
              key={test.listingId}
              label={`${test.itemName} · ${money(test.feePaise)}`}
              checked={extras.includes(test.listingId)}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                onExtras(
                  checked
                    ? [...extras, test.listingId]
                    : extras.filter((id) => id !== test.listingId),
                );
              }}
            />
          ))}
        </fieldset>
      )}
    </>
  );
}
