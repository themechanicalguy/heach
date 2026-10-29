'use client';

import { BottomNav, Icon, type IconName } from '@heach/ui';
import type { Me } from '@heach/types';
import { usePathname } from 'next/navigation';
import { useAccount } from '../lib/account';
import { useI18n } from '../lib/i18n-context';
import { isCareRole, isProviderRole } from '../lib/routing';
import { useSession } from '../lib/session';

interface Props {
  /** OTP accounts are on: "Account" opens the account page, which asks for sign-in. */
  accounts: boolean;
  /** The Step 2 sample note is on (local, test and dev only). */
  sample: boolean;
}

/**
 * The app's one navigation, in the top header: the links sit in the thumb zone at the bottom on
 * phones (UX-03) and between the name and the languages from tablet width. Marks the current page.
 * "Account" shows once signed in; until then the header's sign-in button stands in for it.
 */
interface Link {
  path: string;
  key: Parameters<ReturnType<typeof useI18n>['t']>[0];
  icon: IconName;
}

/** The links for the active role: approved providers get their work, patients their bookings. */
function roleLinks(me: Me | undefined): Link[] {
  if (!me) return [{ path: '', key: 'nav.home', icon: 'home' }];
  const approved = me.roles.some(
    (grant) => grant.side === 'provider' && grant.applicationStatus === 'approved',
  );
  if (isProviderRole(me.activeRole) && approved) {
    const collector = me.activeRole === 'sample_collector';
    return [
      collector
        ? { path: '/provider/collections', key: 'nav.collections', icon: 'note' }
        : { path: '/provider/requests', key: 'nav.requests', icon: 'note' },
      ...(me.activeRole === 'lab'
        ? [{ path: '/provider/lab', key: 'nav.lab', icon: 'file' } as const]
        : []),
      { path: '/provider/bookings', key: 'nav.bookings', icon: 'file' },
      { path: '/provider/services', key: 'nav.services', icon: 'home' },
      { path: '/provider/earnings', key: 'nav.earnings', icon: 'note' },
    ];
  }
  const home: Link = { path: '', key: 'nav.home', icon: 'home' };
  if (isProviderRole(me.activeRole))
    return [home, { path: '/provider', key: 'nav.application', icon: 'file' }];
  if (isCareRole(me.activeRole)) {
    return [
      home,
      { path: '/bookings', key: 'nav.bookings', icon: 'file' },
      { path: '/notifications', key: 'nav.notifications', icon: 'note' },
    ];
  }
  return [home];
}

export function ShellNav({ accounts, sample }: Readonly<Props>) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const { account } = useAccount();
  const { status } = useSession();
  const links = [
    ...roleLinks(account.state === 'ready' ? account.me : undefined),
    ...(sample ? [{ path: '/notes', key: 'nav.notes', icon: 'note' } as const] : []),
    ...(status === 'signed-in'
      ? [
          {
            path: `/${accounts ? 'account' : 'sign-in'}`,
            key: 'nav.account',
            icon: 'user',
          } as const,
        ]
      : []),
  ];
  const items = links.map((link) => ({
    href: `/${locale}${link.path}`,
    label: t(link.key),
    icon: <Icon name={link.icon} />,
    current: pathname === `/${locale}${link.path}`,
  }));
  return <BottomNav label={t('nav.label')} items={items} />;
}
