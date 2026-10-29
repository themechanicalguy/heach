'use client';

import { Icon } from '@heach/ui';
import { usePathname } from 'next/navigation';
import { useI18n } from '../lib/i18n-context';
import { useSession } from '../lib/session';

// Pages that are themselves part of signing in or setting up.
const SIGN_IN_PAGES = /^\/[a-z]{2}\/(sign-in|welcome|setup)(\/|$)/;

/**
 * Sign in or sign up (one OTP flow) from the header, once the session is known to be signed out,
 * so a signed-in person never sees it flash up while the session is restored.
 */
export function SignInLink() {
  const { locale, t } = useI18n();
  const { status } = useSession();
  const pathname = usePathname();
  if (status !== 'signed-out' || SIGN_IN_PAGES.test(pathname)) return null;
  return (
    <a href={`/${locale}/sign-in`} className="heach-button header-sign-in">
      <Icon name="log-in" size={18} />
      {t('nav.signIn')}
    </a>
  );
}
