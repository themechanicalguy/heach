import { Noto_Sans, Noto_Sans_Devanagari, Noto_Sans_Oriya } from 'next/font/google';

// Bundled and subset at build time, served from this origin (I18N-06.1): Latin, Odia and
// Devanagari. Only Latin is preloaded; the script fonts swap in, so text shows at once.
const latin = Noto_Sans({ subsets: ['latin'], variable: '--font-latin', display: 'swap' });
const odia = Noto_Sans_Oriya({
  subsets: ['oriya'],
  variable: '--font-odia',
  display: 'swap',
  preload: false,
});
const devanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-devanagari',
  display: 'swap',
  preload: false,
});

export const fontClassNames = [latin.variable, odia.variable, devanagari.variable].join(' ');
