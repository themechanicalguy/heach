/**
 * Front-end error reporting that keeps personal data out (LM-03, LM-03.1, LM-02), shared by the
 * web app and the admin console. Browser only: nothing here imports the server logger.
 */

/** A URL as telemetry may keep it: no query string, no fragment (LM-03.1, MV-11). */
export function withoutQueryOrFragment(url: string): string {
  return url.split(/[?#]/)[0] ?? '';
}

interface ReportedEvent {
  user?: unknown;
  request?: { url?: string; cookies?: unknown; headers?: unknown; query_string?: unknown };
}

interface Breadcrumb {
  data?: Record<string, unknown>;
}

/** Drops who the user is and what their browser sent; a share link's token is in the fragment. */
function withoutPersonalData<E extends ReportedEvent>(event: E): E {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
    if (event.request.url) event.request.url = withoutQueryOrFragment(event.request.url);
  }
  return event;
}

/** Navigation and fetch breadcrumbs carry full URLs. */
function withShortUrls<B extends Breadcrumb>(breadcrumb: B): B {
  const data = breadcrumb.data;
  for (const key of ['url', 'from', 'to']) {
    const value = data?.[key];
    if (data && typeof value === 'string') data[key] = withoutQueryOrFragment(value);
  }
  return breadcrumb;
}

/** Options for the Sentry browser SDK's `init`, which collect no personal data at all. */
export const PRIVATE_ERROR_REPORTING = {
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    stackFrameVariables: false,
  },
  beforeSend: withoutPersonalData,
  beforeBreadcrumb: withShortUrls,
};
