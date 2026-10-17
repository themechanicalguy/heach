'use client';

import { BottomNav } from '@heach/ui';
import { usePathname } from 'next/navigation';
import { useI18n } from '../lib/i18n-context';

/** Bottom navigation in the thumb zone on phones (UX-03); marks the current page. */
export function ShellNav() {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const items = [
    { href: `/${locale}`, label: t('nav.home') },
    { href: `/${locale}/notes`, label: t('nav.notes') },
    { href: `/${locale}/sign-in`, label: t('nav.account') },
  ].map((item) => ({ ...item, current: pathname === item.href }));
  return <BottomNav label={t('nav.label')} items={items} />;
}
