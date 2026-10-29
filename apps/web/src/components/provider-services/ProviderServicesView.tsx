'use client';

import { ErrorState, Notice, Skeleton } from '@heach/ui';
import type { Availability, ProviderListings } from '@heach/types';
import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { errorMessageKey } from '../../lib/errors';
import { useI18n } from '../../lib/i18n-context';
import { useResource } from '../../lib/use-resource';
import { HoursForm, LeaveForm } from './HoursForm';
import { AreaForm, ListingRow } from './ListingsForm';

/** An Approved provider's services, area, hours and leave in one place (Step 4). */
export function ProviderServicesView() {
  const { t } = useI18n();
  const listings = useResource<ProviderListings>('/provider/listings');
  const hours = useResource<Availability>('/provider/availability');
  const [current, setCurrent] = useState<ProviderListings | undefined>();
  useEffect(() => {
    if (listings.resource.state === 'ready') setCurrent(listings.resource.data);
  }, [listings.resource]);

  const state = listings.resource;
  if (state.state === 'error') {
    if (state.error instanceof ApiError && state.error.code === 'provider_not_approved') {
      return <Notice tone="info">{t('providerServices.notApproved')}</Notice>;
    }
    return (
      <ErrorState
        message={t(errorMessageKey(state.error))}
        retryLabel={t('state.retry')}
        onRetry={() => void listings.reload()}
      />
    );
  }
  if (!current || hours.resource.state !== 'ready') return <Skeleton label={t('state.loading')} />;
  const availability = hours.resource.data;
  return (
    <section className="flow" aria-labelledby="services-title">
      <div className="flow__card">
        <h1 id="services-title" className="flow__title">
          {t('providerServices.title')}
        </h1>
        <p>{t('providerServices.intro')}</p>
        <h2 className="flow__subtitle">{t('providerServices.listings')}</h2>
        <ul className="role-list">
          {current.items.map((item) => (
            <li key={item.code}>
              <ListingRow role={current.role} item={item} onSaved={setCurrent} />
            </li>
          ))}
        </ul>
        <AreaForm listings={current} onSaved={setCurrent} />
        <HoursForm availability={availability} onSaved={() => void hours.reload()} />
        <LeaveForm availability={availability} onChanged={hours.reload} />
      </div>
    </section>
  );
}
