'use client';

import { ErrorState, Skeleton } from '@heach/ui';
import { isCareRole } from '../../lib/routing';
import { useI18n } from '../../lib/i18n-context';
import { errorMessageKey } from '../../lib/errors';
import { useAccount } from '../../lib/account';
import { useSession } from '../../lib/session';
import type { ReactNode } from 'react';

/** The public page is server-rendered; private cards mount only after session restoration. */
export function HomeView({
  publicHome,
  patientHome,
}: Readonly<{ publicHome: ReactNode; patientHome: ReactNode }>) {
  const { status } = useSession();
  const { enabled, account, reload } = useAccount();
  const { t } = useI18n();
  if (enabled && status === 'checking')
    return (
      <>
        <main className="page">
          <Skeleton label={t('state.loading')} />
        </main>
        <div hidden>{publicHome}</div>
      </>
    );
  if (enabled && status === 'signed-in') {
    if (account.state === 'error')
      return (
        <main className="page">
          <ErrorState
            message={t(errorMessageKey(account.error))}
            retryLabel={t('state.retry')}
            onRetry={() => void reload().catch(() => undefined)}
          />
        </main>
      );
    if (account.state !== 'ready')
      return (
        <main className="page">
          <Skeleton label={t('state.loading')} />
        </main>
      );
    if (isCareRole(account.me.activeRole)) return <>{patientHome}</>;
  }
  return <>{publicHome}</>;
}
