'use client';

import { BottomNav, Icon, type IconName } from '@heach/ui';
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
export function ShellNav({ accounts, sample }: Readonly<Props>) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const { account } = useAccount();
  const { status } = useSession();
  const provider = account.state === 'ready' && isProviderRole(account.me.activeRole);
  const approved =
    account.state === 'ready' &&
    account.me.roles.some(
      (grant) => grant.side === 'provider' && grant.applicationStatus === 'approved',
    );
  const link = (path: string, label: string, icon: IconName) => ({
    href: `/${locale}${path}`,
    label,
    icon: <Icon name={icon} />,
  });
  const care = account.state === 'ready' && isCareRole(account.me.activeRole);
  const items = [
    ...(approved ? [] : [link('', t('nav.home'), 'home')]),
    ...(provider && !approved ? [link('/provider', t('nav.application'), 'file')] : []),
    ...(approved
      ? [
          link('/provider/requests', t('nav.requests'), 'note'),
          link('/provider/bookings', t('nav.bookings'), 'file'),
          link('/provider/services', t('nav.services'), 'home'),
          link('/provider/earnings', t('nav.earnings'), 'note'),
        ]
      : []),
    ...(care
      ? [
          link('/bookings', t('nav.bookings'), 'file'),
          link('/notifications', t('nav.notifications'), 'note'),
        ]
      : []),
    ...(sample ? [link('/notes', t('nav.notes'), 'note')] : []),
    ...(status === 'signed-in'
      ? [link(`/${accounts ? 'account' : 'sign-in'}`, t('nav.account'), 'user')]
      : []),
  ].map((item) => ({ ...item, current: pathname === item.href }));
  return <BottomNav label={t('nav.label')} items={items} />;
}
