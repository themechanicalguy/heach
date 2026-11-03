import { Anek_Latin, Anek_Odia, Noto_Sans_Devanagari } from 'next/font/google';

// Bundled and subset at build time, served from this origin (I18N-06.1): Latin, Odia and
// Devanagari. Preload the script subsets too: bilingual headings need Odia, and Hindi
// otherwise discovers its largest font only after CSS, delaying mobile first paint.
const latin = Anek_Latin({ subsets: ['latin'], variable: '--font-latin', display: 'swap' });
const odia = Anek_Odia({
  subsets: ['oriya'],
  variable: '--font-odia',
  display: 'swap',
  adjustFontFallback: false,
});
const devanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-devanagari',
  display: 'swap',
  adjustFontFallback: false,
});

export const fontClassNames = [latin.variable, odia.variable, devanagari.variable].join(' ');
