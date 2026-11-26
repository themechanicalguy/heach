import { PRIVATE_ERROR_REPORTING } from '@heach/logger/browser';
import { useEffect } from 'react';
import { useSession } from './session';

const DSN = import.meta.env.VITE_GLITCHTIP_DSN;
const RELEASE = import.meta.env.VITE_BUILD_VERSION ?? 'dev';

/**
 * The admin console's errors to GlitchTip (LM-03), as the web app sends its own: release tag and
 * the admin's sub-role, never who they are, cookies, headers or query strings. Loaded only once
 * the console runs, and off unless a DSN is built in.
 */
export function ErrorTracking() {
  const { state } = useSession();
  const role = state.status === 'signed-in' ? state.me.role : 'signed-out';
  useEffect(() => {
    if (!DSN) return;
    void import('@sentry/browser').then((Sentry) => {
      if (!Sentry.getClient()) {
        Sentry.init({ dsn: DSN, release: RELEASE, ...PRIVATE_ERROR_REPORTING });
      }
      Sentry.setTag('role', role);
    });
  }, [role]);
  return null;
}
