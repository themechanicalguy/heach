'use client';

import { BottomNav } from '@heach/ui';
import { usePathname } from 'next/navigation';
import { useAccount } from '../lib/account';
import { useI18n } from '../lib/i18n-context';
import { isProviderRole } from '../lib/routing';

interface Props {
  /** OTP accounts are on: "Account" opens the account page, which asks for sign-in. */
  accounts: boolean;
  /** The Step 2 sample note is on (local, test and dev only). */
  sample: boolean;
}

/** Bottom navigation in the thumb zone on phones (UX-03); marks the current page. */
export function ShellNav({ accounts, sample }: Readonly<Props>) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const { account } = useAccount();
  const provider = account.state === 'ready' && isProviderRole(account.me.activeRole);
  const items = [
    { href: `/${locale}`, label: t('nav.home') },
    ...(provider ? [{ href: `/${locale}/provider`, label: t('nav.application') }] : []),
    ...(sample ? [{ href: `/${locale}/notes`, label: t('nav.notes') }] : []),
    { href: `/${locale}/${accounts ? 'account' : 'sign-in'}`, label: t('nav.account') },
  ].map((item) => ({ ...item, current: pathname === item.href }));
  return <BottomNav label={t('nav.label')} items={items} />;
}
