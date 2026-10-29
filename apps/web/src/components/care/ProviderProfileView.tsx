'use client';

import { formatDateTime, formatPaise } from '@heach/i18n';
import { Card, ErrorState, Notice, Skeleton } from '@heach/ui';
import type { ProfileListing, ProviderProfile, Slots } from '@heach/types';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { errorMessageKey } from '../../lib/errors';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';

const LANGUAGE_NAMES: Record<string, string> = { or: 'ଓଡ଼ିଆ', en: 'English', hi: 'हिन्दी' };

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
            languages: profile.languages.map((code) => LANGUAGE_NAMES[code] ?? code).join(', '),
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

function SlotPicker({
  providerId,
  listingId,
}: Readonly<{ providerId: string; listingId: string }>) {
  const { locale, t } = useI18n();
  const { resource, reload } = useResource<Slots>(
    `/providers/${providerId}/slots?listing=${listingId}&days=7`,
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
  const slots = resource.data.slots.slice(0, 12);
  if (slots.length === 0) return <p className="flow__muted">{t('profile.noTimes')}</p>;
  return (
    <>
      <h3 className="flow__subtitle">{t('profile.times')}</h3>
      <ul className="slot-list">
        {slots.map((slot) => (
          <li key={slot}>
            <Link
              className="heach-button heach-button--secondary"
              href={`/${locale}/book/${listingId}?provider=${providerId}&start=${encodeURIComponent(slot)}`}
            >
              {t('profile.book', { time: formatDateTime(new Date(slot), locale) })}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
