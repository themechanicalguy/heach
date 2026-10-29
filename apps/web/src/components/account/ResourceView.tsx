'use client';

import { ErrorState, Skeleton } from '@heach/ui';
import type { ReactNode } from 'react';
import { errorMessageKey } from '../../lib/errors';
import { useI18n } from '../../lib/i18n-context';
import type { Resource } from '../../lib/use-resource';

interface Props<T> {
  resource: Resource<T>;
  reload: () => Promise<void>;
  children: (data: T) => ReactNode;
}

/** Loading, error with retry, or the data (UX-04). */
export function ResourceView<T>({ resource, reload, children }: Readonly<Props<T>>) {
  const { t } = useI18n();
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
  return <>{children(resource.data)}</>;
}
