/**
 * Content Security Policy for pages (SO-05.1): scripts only from this origin or carrying the
 * per-request nonce, never inline without it; no framing; API calls to this origin only, plus the
 * GlitchTip origin when error tracking is configured (LM-03.1).
 */
export function contentSecurityPolicy(
  nonce: string,
  development: boolean,
  errorTrackingDsn?: string,
): string {
  const errorTracking = errorTrackingDsn ? ` ${new URL(errorTrackingDsn).origin}` : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${errorTracking}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}
