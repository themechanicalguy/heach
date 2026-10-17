'use client';

import { OfflineBanner } from '@heach/ui';
import { useSyncExternalStore } from 'react';
import { useI18n } from '../lib/i18n-context';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Offline banner while the browser reports no connection (UX-04, PF-07). */
export function OfflineStatus() {
  const { t } = useI18n();
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  return online ? null : <OfflineBanner message={t('offline.banner')} />;
}
