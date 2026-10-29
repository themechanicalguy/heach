'use client';

import { Icon } from '@heach/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useI18n } from '../lib/i18n-context';
import { useSession } from '../lib/session';
import { usePending } from '../lib/use-pending';

// Pages that are themselves part of signing in or setting up.
const SIGN_IN_PAGES = /^\/[a-z]{2}\/(sign-in|welcome|setup)(\/|$)/;

/**
 * Sign in or sign up (one OTP flow) once the session is known to be signed out, and sign out of
 * this device once signed in, so neither flashes up while the session is restored (SE-07.10).
 */
export function HeaderAccount() {
  const { locale, t } = useI18n();
  const { status, signOut } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const { pending, run } = usePending();
  if (status === 'signed-in') {
    // The session ends on this device even when the logout call fails, so go home either way.
    const leave = () =>
      run(async () => {
        await signOut().catch(() => undefined);
        router.replace(`/${locale}`);
      });
    return (
      <button type="button" className="header-pill" disabled={pending} onClick={() => void leave()}>
        <Icon name="log-out" size={18} />
        {t('nav.signOut')}
      </button>
    );
  }
  if (status !== 'signed-out' || SIGN_IN_PAGES.test(pathname)) return null;
  return (
    <a href={`/${locale}/sign-in`} className="heach-button header-sign-in">
      <Icon name="log-in" size={18} />
      {t('nav.signIn')}
    </a>
  );
}
