'use client';

import { formatDate } from '@heach/i18n';
import type { IdentityDetails } from '@heach/types';
import { useI18n } from '../../lib/i18n-context';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';

/** What the identity partner verified beyond the name and gender (KY-03); the provider's own view. */
export function VerifiedDetails() {
  const { locale, t } = useI18n();
  const { resource, reload } = useResource<IdentityDetails>(
    '/provider/application/identity/details',
  );
  return (
    <section aria-labelledby="verified-details-title">
      <h3 id="verified-details-title">{t('application.verifiedDetails.title')}</h3>
      <ResourceView resource={resource} reload={reload}>
        {(details) => (
          <dl>
            <dt>{t('application.verifiedDetails.dateOfBirth')}</dt>
            <dd>{formatDate(new Date(details.dateOfBirth), locale)}</dd>
            <dt>{t('application.verifiedDetails.address')}</dt>
            <dd>{details.address}</dd>
          </dl>
        )}
      </ResourceView>
      <p className="flow__muted">{t('application.verifiedDetails.note')}</p>
    </section>
  );
}
