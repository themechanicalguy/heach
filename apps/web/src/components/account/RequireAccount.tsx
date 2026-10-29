'use client';

import { Button, ErrorState, Notice, Skeleton } from '@heach/ui';
import type { Me } from '@heach/types';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useAccount } from '../../lib/account';
import { errorMessageKey } from '../../lib/errors';
import { useI18n } from '../../lib/i18n-context';
import { destinationFor, isCareRole, isOrganisationOwner, isProviderRole } from '../../lib/routing';
import { useSession } from '../../lib/session';

export type PageKind = 'setup' | 'consent' | 'care' | 'provider' | 'owner' | 'any';

interface Props {
  page: PageKind;
  children: (me: Me) => ReactNode;
}

/** Where this account must go instead of this page, if anywhere. */
function redirectFor(me: Me, page: PageKind, pathname: string): string | undefined {
  const home = destinationFor(me);
  if (!me.setup.complete) return page === 'setup' ? undefined : home;
  if (page === 'setup') return home;
  if (me.consentsDue.length > 0) return page === 'consent' ? undefined : home;
  if (page === 'consent') return home;
  if (!pathname.startsWith(`/${me.locale}`)) return `/${me.locale}${pathname.slice(3)}`;
  return undefined;
}

function roleFits(role: string, page: PageKind): boolean {
  if (page === 'care') return isCareRole(role);
  if (page === 'provider') return isProviderRole(role);
  if (page === 'owner') return isOrganisationOwner(role);
  return true;
}

/**
 * Client-side page guard: sign-in first (keeping a safe `next`), unfinished setup and due
 * consents next, then the role. It only decides what to show; the API authorises every request
 * on the server (SE-02).
 */
export function RequireAccount({ page, children }: Readonly<Props>) {
  const { locale, t } = useI18n();
  const { status } = useSession();
  const { account, reload } = useAccount();
  const router = useRouter();
  const pathname = usePathname();
  const me = account.state === 'ready' ? account.me : undefined;
  const redirect = me && redirectFor(me, page, pathname);

  useEffect(() => {
    if (status === 'signed-out') {
      router.replace(`/${locale}/sign-in?next=${encodeURIComponent(pathname)}`);
    } else if (redirect) {
      router.replace(redirect);
    }
  }, [status, redirect, router, locale, pathname]);

  if (account.state === 'error') {
    return (
      <ErrorState
        message={t(errorMessageKey(account.error))}
        retryLabel={t('state.retry')}
        onRetry={() => void reload().catch(() => undefined)}
      />
    );
  }
  if (!me || redirect) return <Skeleton label={t('guard.checking')} />;
  if (!roleFits(me.activeRole, page)) {
    return (
      <section className="flow__card">
        <Notice tone="warning">{t('guard.wrongRole')}</Notice>
        <p>{t('guard.switchHint')}</p>
        <Button
          onClick={() => {
            router.push(`/${locale}/account`);
          }}
        >
          {t('guard.toAccount')}
        </Button>
      </section>
    );
  }
  return <>{children(me)}</>;
}
