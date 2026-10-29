'use client';

import { BottomNav, Icon } from '@heach/ui';
import { usePathname } from 'next/navigation';
import { useAccount } from '../lib/account';
import { useI18n } from '../lib/i18n-context';
import { isProviderRole } from '../lib/routing';
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
  const items = [
    { href: `/${locale}`, label: t('nav.home'), icon: <Icon name="home" /> },
    ...(provider
      ? [{ href: `/${locale}/provider`, label: t('nav.application'), icon: <Icon name="file" /> }]
      : []),
    ...(sample
      ? [{ href: `/${locale}/notes`, label: t('nav.notes'), icon: <Icon name="note" /> }]
      : []),
    ...(status === 'signed-in'
      ? [
          {
            href: `/${locale}/${accounts ? 'account' : 'sign-in'}`,
            label: t('nav.account'),
            icon: <Icon name="user" />,
          },
        ]
      : []),
  ].map((item) => ({ ...item, current: pathname === item.href }));
  return <BottomNav label={t('nav.label')} items={items} />;
}
