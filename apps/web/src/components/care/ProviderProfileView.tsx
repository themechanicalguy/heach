'use client';

import { formatDateTime, formatPaise, isLocale } from '@heach/i18n';
import { Card, ErrorState, Notice, Skeleton } from '@heach/ui';
import { useState } from 'react';
import type { ProfileListing, ProviderProfile, Slots } from '@heach/types';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { errorMessageKey } from '../../lib/errors';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';
import { DayTimePicker } from '../booking/DayTimePicker';

/** A provider's public profile with free times per service (PO-05, AV-02). */
export function ProviderProfileView({ providerId }: Readonly<{ providerId: string }>) {
  const { locale } = useI18n();
  const { resource, reload } = useResource<ProviderProfile>(
    `/providers/${providerId}?locale=${locale}`,
  );
  return (
    <ResourceView resource={resource} reload={reload}>
      {(profile) => <Profile profile={profile} />}
    </ResourceView>
  );
}

function Profile({ profile }: Readonly<{ profile: ProviderProfile }>) {
  const { t } = useI18n();
  const params = useSearchParams();
  const chosen = params.get('listing');
  const listings = chosen
    ? [...profile.listings].sort((a) => (a.listingId === chosen ? -1 : 1))
    : profile.listings;
  return (
    <section className="flow" aria-labelledby="profile-title">
      <div className="flow__card">
        <h1 id="profile-title" className="flow__title">
          {profile.name}
        </h1>
        <p className="flow__muted">
          {t(keyFor('roles', profile.role, 'profile.services', '.label'))}
        </p>
        {profile.identityVerified && <Notice tone="success">{t('profile.verified')}</Notice>}
        {profile.registrationNumber && (
          <p>{t('profile.registration', { number: profile.registrationNumber })}</p>
        )}
        <p>
          {t('profile.languages', {
            languages: profile.languages
              .map((code) => (isLocale(code) ? t(`languages.${code}`) : code))
              .join(', '),
          })}
        </p>
        <p className="flow__muted">
          {profile.rating === null
            ? t('profile.noRating')
            : t('profile.rating', {
                rating: profile.rating.toFixed(1),
                count: profile.ratingCount,
              })}
        </p>
        <p className="flow__muted">{t('profile.area', { pins: profile.pins.join(', ') })}</p>
        <h2 className="flow__subtitle">{t('profile.services')}</h2>
        <ul className="role-list">
          {listings.map((listing) => (
            <li key={listing.listingId}>
              <ListingCard providerId={profile.id} listing={listing} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ListingCard({
  providerId,
  listing,
}: Readonly<{ providerId: string; listing: ProfileListing }>) {
  const { t } = useI18n();
  return (
    <Card title={listing.itemName}>
      <p>
        {formatPaise(listing.feePaise)} ·{' '}
        {t('profile.duration', { minutes: listing.durationMinutes })}
      </p>
      {listing.prescriptionRequired && <Notice tone="warning">{t('profile.prescription')}</Notice>}
      {listing.preparation && (
        <p className="flow__muted">{t('profile.preparation', { text: listing.preparation })}</p>
      )}
      <SlotPicker providerId={providerId} listingId={listing.listingId} />
    </Card>
  );
}

/** Days of free times the server is asked for (AV-02); the copy says "the next 7 days". */
export const SLOT_DAYS = 7;

/**
 * A listing's free times as the day and time picker (G07). With `onSelect` the time is chosen in
 * place (the booking page); without it, the chosen time links to the booking page (profile).
 */
export function SlotPicker({
  providerId,
  listingId,
  onSelect,
  selected = '',
}: Readonly<{
  providerId: string;
  listingId: string;
  onSelect?: (time: string) => void;
  selected?: string;
}>) {
  const { locale, t } = useI18n();
  const [picked, setPicked] = useState(selected);
  const { resource, reload } = useResource<Slots>(
    `/providers/${providerId}/slots?listing=${listingId}&days=${String(SLOT_DAYS)}`,
  );
  if (resource.state === 'loading') return <Skeleton label={t('state.loading')} />;
  if (resource.state === 'error') {
    return (
      <ErrorState
        message={t(errorMessageKey(resource.error))}
        retryLabel={t('state.retry')}
        onRetry={() => void reload()}
      />
    );
  }
  if (resource.data.slots.length === 0)
    return <p className="flow__muted">{t('profile.noTimes')}</p>;
  return (
    <>
      {!onSelect && <h3 className="flow__subtitle">{t('profile.times')}</h3>}
      <DayTimePicker
        slots={resource.data.slots}
        horizon={SLOT_DAYS}
        selected={onSelect ? selected : picked}
        onSelect={onSelect ?? setPicked}
      />
      {!onSelect && picked && (
        <Link
          className="heach-button"
          href={`/${locale}/book/${listingId}?provider=${providerId}&start=${encodeURIComponent(picked)}`}
        >
          {t('profile.book', { time: formatDateTime(new Date(picked), locale) })}
        </Link>
      )}
    </>
  );
}
