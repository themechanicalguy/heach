# Self-hosted fonts

These are the unchanged WOFF2 subsets previously emitted by `next/font/google`:
Anek Latin v11, Anek Odia v17 and Noto Sans Devanagari v33. They retain the
original variable weights, Unicode ranges and glyph coverage. The accompanying
OFL files contain their SIL Open Font Licenses and copyright notices.

Source families: [Anek Latin](https://fonts.google.com/specimen/Anek+Latin),
[Anek Odia](https://fonts.google.com/specimen/Anek+Odia),
[Noto Sans Devanagari](https://fonts.google.com/noto/specimen/Noto+Sans+Devanagari).
The upstream projects are [EkType/Anek](https://github.com/EkType/Anek) and
[notofonts/devanagari](https://github.com/notofonts/devanagari).

`src/app/fonts.css` retains the generated face definitions and metric-adjusted
fallbacks. `src/app/fonts.ts` selects early preloads by locale: Devanagari first, then Odia and Latin for Hindi pages; Latin and Odia for
English and Odia pages. The active script receives high fetch priority. Other subsets load
only when their glyphs are used. This avoids preloading an unused Hindi subset
on every route and lets Hindi's primary font start first. Browsers contact only
this origin; builds also no longer need Google Fonts network access.

Keep content-hashed filenames when updating fonts: Next serves WOFF2 files here
with immutable caching. Preserve the licences and Unicode ranges, update both
the CSS and preload paths, and run the existing font, visual, bundle and mobile
Lighthouse checks in all three locales.
