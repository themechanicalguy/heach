'use client';

import type { SearchResult } from '@heach/types';
import { EmptyState } from '@heach/ui';
import { useCareSearch } from '../../lib/care-search';
import { useI18n } from '../../lib/i18n-context';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';
import { ProviderCard } from '../care/ProviderCard';
import { PIN_PATTERN } from '../care/services';

/** Providers for the current search; on the patient home only once a PIN code is known. */
export function NearbyProviders({
  onlyAfterSearch = false,
}: Readonly<{ onlyAfterSearch?: boolean }>) {
  const { locale, t } = useI18n();
  const { search } = useCareSearch();
  const { resource, reload } = useResource<SearchResult[]>(
    '/search',
    JSON.stringify({ ...search, q: search.q || undefined, locale }),
    PIN_PATTERN.test(search.pin),
  );
  if (onlyAfterSearch && !PIN_PATTERN.test(search.pin)) return null;
  return (
    <section className="site-section">
      <h2>{t('site.near')}</h2>
      {!PIN_PATTERN.test(search.pin) ? (
        <p>{t('search.pinHint')}</p>
      ) : (
        <ResourceView resource={resource} reload={reload}>
          {(rows) =>
            rows.length ? (
              <ul className="site-provider-grid">
                {rows.slice(0, 3).map((row) => (
                  <li key={row.listingId}>
                    <ProviderCard result={row} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message={t('search.empty')} />
            )
          }
        </ResourceView>
      )}
    </section>
  );
}
