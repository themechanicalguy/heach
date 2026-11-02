'use client';

import { formatDateTime, formatPaise } from '@heach/i18n';
import { Button, Notice, Skeleton, TextField } from '@heach/ui';
import type { AnySlots, CatalogueItem, ProviderProfile } from '@heach/types';
import { useState } from 'react';
import { useCareSearch } from '../../lib/care-search';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '../../lib/i18n-context';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';
import { PIN_PATTERN } from '../care/services';
import { SlotPicker } from '../care/ProviderProfileView';
import { BookingForm } from './BookingForm';

/** Booking a chosen provider at a time picked on their profile (J3, J4). */
export function BookChosen({ listingId }: Readonly<{ listingId: string }>) {
  const { locale, t } = useI18n();
  const params = useSearchParams();
  const providerId = params.get('provider') ?? '';
  const [start, setStart] = useState(params.get('start') ?? '');
  const [review, setReview] = useState(false);
  const profile = useResource<ProviderProfile>(`/providers/${providerId}?locale=${locale}`);
  return (
    <section className="flow booking-flow" aria-labelledby="book-title">
      <div className="flow__card">
        <ResourceView resource={profile.resource} reload={profile.reload}>
          {(data) => {
            const listing = data.listings.find((entry) => entry.listingId === listingId);
            if (!listing) return <Notice tone="warning">{t('book.noTimes')}</Notice>;
            return (
              <>
                <h1 id="book-title" className="flow__title">
                  {data.name}
                </h1>
                {!review && (
                  <SlotPicker
                    providerId={providerId}
                    listingId={listingId}
                    selected={start}
                    onSelect={setStart}
                  />
                )}
                {start && (
                  <BookingForm
                    onBooked={() => {
                      setReview(true);
                    }}
                    target={{ kind: 'chosen', listingId }}
                    facts={listing}
                    startsAt={start}
                    labTests={data.listings.filter(
                      (entry) => entry.kind === 'lab_test' && entry.listingId !== listingId,
                    )}
                  />
                )}
              </>
            );
          }}
        </ResourceView>
      </div>
    </section>
  );
}

/** "Any available provider" (amendment A10): choose a time, then the booking details. */
export function BookAny({ itemCode }: Readonly<{ itemCode: string }>) {
  const { locale, t } = useI18n();
  const params = useSearchParams();
  const { search } = useCareSearch();
  const pin = search.pin;
  const [start, setStart] = useState<string | null>(params.get('start'));
  const slots = useResource<AnySlots>(
    '/search/any-slots',
    JSON.stringify({ item: itemCode, pin }),
    PIN_PATTERN.test(pin),
  );
  const catalogue = useResource<CatalogueItem[]>(`/catalogue?locale=${locale}`);
  const item =
    catalogue.resource.state === 'ready'
      ? catalogue.resource.data.find((entry) => entry.code === itemCode)
      : undefined;
  return (
    <section className="flow booking-flow" aria-labelledby="any-title">
      <div className="flow__card">
        <h1 id="any-title" className="flow__title">
          {t('book.anyTitle')}
        </h1>
        <p>{t('book.anyIntro')}</p>
        {PIN_PATTERN.test(pin) ? (
          <AnyBody
            itemCode={itemCode}
            pin={pin}
            start={start}
            item={item}
            slots={slots}
            onSelect={setStart}
          />
        ) : (
          <BookingPin />
        )}
      </div>
    </section>
  );
}

interface AnyBodyProps {
  onSelect: (slot: string) => void;
  itemCode: string;
  pin: string;
  start: string | null;
  item: CatalogueItem | undefined;
  slots: ReturnType<typeof useResource<AnySlots>>;
}

function AnyBody({ itemCode, pin, start, item, slots, onSelect }: Readonly<AnyBodyProps>) {
  const { locale, t } = useI18n();
  if (!item) return <Skeleton label={t('state.loading')} />;
  if (start) {
    const facts = {
      itemName: item.name,
      kind: item.kind,
      prescriptionRequired: item.prescriptionRequired,
    };
    return <BookingForm target={{ kind: 'any', itemCode, pin }} facts={facts} startsAt={start} />;
  }
  return (
    <ResourceView resource={slots.resource} reload={slots.reload}>
      {(data) =>
        data.slots.length === 0 ? (
          <p className="flow__muted">{t('book.noTimes')}</p>
        ) : (
          <>
            <Notice tone="info">{t('book.anyQuote', { fee: formatPaise(data.quotePaise) })}</Notice>
            <h2 className="flow__subtitle">{t('book.chooseTime')}</h2>
            <ul className="slot-list">
              {data.slots.slice(0, 16).map((slot) => (
                <li key={slot}>
                  <button
                    type="button"
                    className="heach-button heach-button--secondary"
                    onClick={() => {
                      onSelect(slot);
                    }}
                  >
                    {formatDateTime(new Date(slot), locale)}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )
      }
    </ResourceView>
  );
}

/** Re-enter location after a reload: private search intent is deliberately not persisted. */
function BookingPin() {
  const { t } = useI18n();
  const { search, setSearch } = useCareSearch();
  const [pin, setPin] = useState(search.pin);
  const [invalid, setInvalid] = useState(false);
  return (
    <form
      className="flow__form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!PIN_PATTERN.test(pin)) {
          setInvalid(true);
          return;
        }
        setSearch({ ...search, pin });
      }}
    >
      <TextField
        label={t('search.pin')}
        hint={t('search.pinHint')}
        inputMode="numeric"
        autoComplete="postal-code"
        value={pin}
        maxLength={6}
        error={invalid ? t('search.pinInvalid') : undefined}
        onChange={(event) => {
          setPin(event.currentTarget.value.trim());
        }}
      />
      <Button type="submit">{t('setup.continue')}</Button>
    </form>
  );
}
