'use client';

import { normalizeDigits } from '@heach/i18n';
import { formatPaise } from '@heach/i18n';
import { Button, Notice, Skeleton, TextField } from '@heach/ui';
import type { AnySlots, CatalogueItem, ProviderProfile } from '@heach/types';
import { useState } from 'react';
import { useCareSearch } from '../../lib/care-search';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '../../lib/i18n-context';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';
import { PIN_PATTERN } from '../care/services';
import { SLOT_DAYS, SlotPicker } from '../care/ProviderProfileView';
import { DayTimePicker } from './DayTimePicker';
import { BookingForm } from './BookingForm';

/** Booking a chosen provider at a time picked here or on their profile (J3, J4). */
export function BookChosen({ listingId }: Readonly<{ listingId: string }>) {
  const { locale, t } = useI18n();
  const params = useSearchParams();
  const providerId = params.get('provider') ?? '';
  const [start, setStart] = useState(params.get('start') ?? '');
  const profile = useResource<ProviderProfile>(`/providers/${providerId}?locale=${locale}`);
  return (
    <section className="booking-page" aria-labelledby="book-title">
      <ResourceView resource={profile.resource} reload={profile.reload}>
        {(data) => {
          const listing = data.listings.find((entry) => entry.listingId === listingId);
          if (!listing) return <Notice tone="warning">{t('book.noTimes')}</Notice>;
          return (
            <>
              <header className="booking-page__head">
                <h1 id="book-title" className="flow__title">
                  {t('book.title', { service: listing.itemName })}
                </h1>
                <p className="flow__muted">{data.name}</p>
              </header>
              <BookingForm
                target={{ kind: 'chosen', listingId }}
                facts={listing}
                startsAt={start}
                providerName={data.name}
                schedule={
                  <SlotPicker
                    providerId={providerId}
                    listingId={listingId}
                    selected={start}
                    onSelect={setStart}
                  />
                }
                labTests={data.listings.filter(
                  (entry) => entry.kind === 'lab_test' && entry.listingId !== listingId,
                )}
              />
            </>
          );
        }}
      </ResourceView>
    </section>
  );
}

/** "Any available provider" (amendment A10): choose a time, then the booking details. */
export function BookAny({ itemCode }: Readonly<{ itemCode: string }>) {
  const { locale, t } = useI18n();
  const params = useSearchParams();
  const { search } = useCareSearch();
  const pin = search.pin;
  const [start, setStart] = useState(params.get('start') ?? '');
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
    <section className="booking-page" aria-labelledby="any-title">
      <header className="booking-page__head">
        <h1 id="any-title" className="flow__title">
          {t('book.anyTitle')}
        </h1>
        <p className="flow__muted">{t('book.anyIntro')}</p>
      </header>
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
        <div className="flow__card booking-page__pin">
          <BookingPin />
        </div>
      )}
    </section>
  );
}

interface AnyBodyProps {
  onSelect: (slot: string) => void;
  itemCode: string;
  pin: string;
  start: string;
  item: CatalogueItem | undefined;
  slots: ReturnType<typeof useResource<AnySlots>>;
}

function AnyBody({ itemCode, pin, start, item, slots, onSelect }: Readonly<AnyBodyProps>) {
  const { t } = useI18n();
  if (!item) return <Skeleton label={t('state.loading')} />;
  return (
    <ResourceView resource={slots.resource} reload={slots.reload}>
      {(data) => (
        <BookingForm
          target={{ kind: 'any', itemCode, pin }}
          facts={{
            itemName: item.name,
            kind: item.kind,
            prescriptionRequired: item.prescriptionRequired,
            feePaise: data.quotePaise,
          }}
          startsAt={start}
          schedule={
            data.slots.length === 0 ? (
              <p className="flow__muted">{t('book.noTimes')}</p>
            ) : (
              <>
                <Notice tone="info">
                  {t('book.anyQuote', { fee: formatPaise(data.quotePaise) })}
                </Notice>
                <DayTimePicker
                  slots={data.slots}
                  horizon={SLOT_DAYS}
                  selected={start}
                  onSelect={onSelect}
                />
              </>
            )
          }
        />
      )}
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
          setPin(normalizeDigits(event.currentTarget.value.trim()));
        }}
      />
      <Button type="submit">{t('setup.continue')}</Button>
    </form>
  );
}
