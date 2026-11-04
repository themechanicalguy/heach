import type { Locale } from '@heach/i18n';

const LATIN = '/fonts/c57421e1d9255fc5-s.p.1pv4tz9e8k6lo.woff2';
const ODIA = '/fonts/c5abf1a92993a674-s.p.2xj_0ydqky0bd.woff2';
const DEVANAGARI = '/fonts/noto-sans-devanagari-400-800-f4e32fd218bb9eda.woff2';

/**
 * Preload only the scripts a locale's pages show (PF-03, I18N-06). The other scripts' faces still
 * load on demand by unicode-range, e.g. a language's own name in the open language menu.
 */
export function criticalFontFiles(locale: Locale): readonly string[] {
  if (locale === 'hi') return [DEVANAGARI, LATIN];
  return locale === 'or' ? [ODIA, LATIN] : [LATIN];
}
