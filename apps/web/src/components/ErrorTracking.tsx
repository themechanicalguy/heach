'use client';

import { useEffect } from 'react';
import { useSession } from '../lib/session';
import { withoutQueryOrFragment } from '../lib/telemetry-urls';

const DSN = process.env.NEXT_PUBLIC_GLITCHTIP_DSN;
const RELEASE = process.env.NEXT_PUBLIC_BUILD_VERSION ?? 'dev';

/**
 * Front-end errors to GlitchTip through the Sentry browser SDK (LM-03): release tag and role,
 * never the user's identity, cookies, headers or query strings. Loaded after hydration so it
 * stays out of the initial JavaScript (PF-02). Off unless a DSN is configured.
 */
export function ErrorTracking() {
  const { status } = useSession();
  useEffect(() => {
    if (!DSN) return;
    void import('@sentry/browser').then((Sentry) => {
      if (!Sentry.getClient()) {
        Sentry.init({
          dsn: DSN,
          release: RELEASE,
          // Collect no personal data at all (LM-03.1, LM-02).
          dataCollection: {
            userInfo: false,
            cookies: false,
            httpHeaders: false,
            httpBodies: [],
            urlQueryParams: false,
            stackFrameVariables: false,
          },
          beforeSend(event) {
            delete event.user;
            if (event.request) {
              delete event.request.cookies;
              delete event.request.headers;
              delete event.request.query_string;
              if (event.request.url) event.request.url = withoutQueryOrFragment(event.request.url);
            }
            return event;
          },
          // Navigation and fetch breadcrumbs carry full URLs; a share link's token is its fragment.
          beforeBreadcrumb(breadcrumb) {
            const data = breadcrumb.data;
            for (const key of ['url', 'from', 'to'])
              if (data && typeof data[key] === 'string')
                data[key] = withoutQueryOrFragment(data[key]);
            return breadcrumb;
          },
        });
      }
      // Step 2 test sign-in is patient only; Step 3 sets the real role.
      Sentry.setTag('role', status === 'signed-in' ? 'patient' : 'anonymous');
    });
  }, [status]);
  return null;
}
