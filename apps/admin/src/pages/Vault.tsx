import { ErrorState, Skeleton } from '@heach/ui';
import type { VaultStats } from '@heach/types';
import { useCallback } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';

/** Vault operations (AD-15): storage, failed uploads, sharing volume and deletion requests; no content. */
export function Vault() {
  const { loaded, reload } = useLoad(useCallback(() => api<VaultStats>('/vault/stats'), []));
  if (loaded.state === 'loading') return <Skeleton label={t('state.loading')} />;
  if (loaded.state === 'error')
    return (
      <ErrorState
        message={errorText(loaded.error)}
        retryLabel={t('state.retry')}
        onRetry={reload}
      />
    );
  const stats = loaded.value;
  return (
    <>
      <h1>{t('vault.title')}</h1>
      <p>{t('vault.intro')}</p>
      <dl className="admin-facts">
        <dt>{t('vault.records')}</dt>
        <dd>{stats.records}</dd>
        <dt>{t('vault.storage')}</dt>
        <dd>{`${(stats.storageBytes / 1_048_576).toFixed(1)} MB`}</dd>
        <dt>{t('vault.infected')}</dt>
        <dd>{stats.infectedUploads}</dd>
        <dt>{t('vault.shares')}</dt>
        <dd>{stats.activeShares}</dd>
        <dt>{t('vault.links')}</dt>
        <dd>{stats.activeLinks}</dd>
        <dt>{t('vault.deletions')}</dt>
        <dd>{stats.openDeletionRequests}</dd>
      </dl>
    </>
  );
}
