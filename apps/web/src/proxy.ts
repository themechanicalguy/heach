import { isLocale } from '@heach/i18n';
import { type NextRequest, NextResponse } from 'next/server';
import { contentSecurityPolicy } from './security/csp';
import { negotiateLocale } from './i18n/negotiate';
import { serverFlags } from './lib/flags';

/** The language last used in this browser; not personal data, readable by the page (AC-02). */
const LANGUAGE_COOKIE = 'heach_lang';
const YEAR_SECONDS = 365 * 24 * 60 * 60;

/** `/` on first launch goes to the language choice; later it goes to the language last used. */
function rootRedirect(request: NextRequest): NextResponse {
  const remembered = request.cookies.get(LANGUAGE_COOKIE)?.value ?? '';
  if (isLocale(remembered)) return NextResponse.redirect(new URL(`/${remembered}`, request.url));
  const locale = negotiateLocale(request.headers.get('accept-language'));
  const firstLaunch = accountsOn() ? '/welcome' : '';
  return NextResponse.redirect(new URL(`/${locale}${firstLaunch}`, request.url));
}

function accountsOn(): boolean {
  return serverFlags().isOn('accounts');
}

/**
 * Every page lives under /or, /en or /hi (I18N-01.1); other paths redirect to the user's
 * language. Each response gets a fresh CSP nonce, so no inline script runs without it (SO-05.1).
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split('/')[1] ?? '';
  if (pathname === '/') return rootRedirect(request);
  if (!isLocale(first)) {
    const locale = negotiateLocale(request.headers.get('accept-language'));
    return NextResponse.redirect(new URL(`/${locale}${pathname}${search}`, request.url));
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === 'development',
    process.env.NEXT_PUBLIC_GLITCHTIP_DSN,
  );
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  if (accountsOn() && !pathname.startsWith(`/${first}/welcome`)) {
    response.cookies.set(LANGUAGE_COOKIE, first, {
      path: '/',
      maxAge: YEAR_SECONDS,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
    });
  }
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not the API, Next assets, the service worker, the manifest or health checks.
      source:
        '/((?!api|_next/static|_next/image|healthz|sw.js|manifest.webmanifest|icons|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
