import type { Locale } from '@heach/i18n';

const LATIN = '/fonts/c57421e1d9255fc5-s.p.1pv4tz9e8k6lo.woff2';
const ODIA = '/fonts/c5abf1a92993a674-s.p.2xj_0ydqky0bd.woff2';
const DEVANAGARI = '/fonts/e92fa6abd9c612ef-s.p.2oqonvbxcl6a7.woff2';

/** Prioritize visible scripts; bilingual headings use Odia in every locale (PF-03, I18N-06). */
export function criticalFontFiles(locale: Locale): readonly string[] {
  if (locale === 'hi') return [DEVANAGARI, ODIA, LATIN];
  return locale === 'or' ? [ODIA, LATIN] : [LATIN, ODIA];
}
