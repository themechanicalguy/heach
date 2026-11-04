'use client';

import { Icon } from '@heach/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useI18n } from '../lib/i18n-context';
import { useSession } from '../lib/session';
import { usePending } from '../lib/use-pending';

// Pages that are themselves part of signing in or setting up.
const SIGN_IN_PAGES = /^\/[a-z]{2}\/(sign-in|welcome|setup)(\/|$)/;

/** Signs this device out (SE-07.10) and goes home, even when the logout call fails. */
export function SignOutButton() {
  const { locale, t } = useI18n();
  const { signOut } = useSession();
  const router = useRouter();
  const { pending, run } = usePending();
  const leave = () =>
    run(async () => {
      await signOut().catch(() => undefined);
      router.replace(`/${locale}`);
    });
  return (
    <button
      type="button"
      className="header-menu__item"
      disabled={pending}
      onClick={() => void leave()}
    >
      <Icon name="log-out" size={20} />
      {t('nav.signOut')}
    </button>
  );
}

/**
 * Sign in or sign up (one OTP flow) once the session is known to be signed out. Signed in, signing
 * out sits in the account menu (HeaderCare), so the phone header stays one row (G01).
 */
export function HeaderAccount() {
  const { locale, t } = useI18n();
  const { status } = useSession();
  const pathname = usePathname();
  if (status === 'signed-in' || SIGN_IN_PAGES.test(pathname)) return null;
  // Reserve the signed-out action's space while restoring the session (PF-03: no layout shift).
  const checking = status === 'checking';
  return (
    <a
      href={checking ? undefined : `/${locale}/sign-in`}
      aria-hidden={checking || undefined}
      className="heach-button header-sign-in"
    >
      <Icon name="log-in" size={18} />
      {t('nav.signIn')}
    </a>
  );
}
