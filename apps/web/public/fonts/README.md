# Self-hosted fonts

These WOFF2 subsets come from the fonts previously emitted by `next/font/google`:
Anek Latin v11, Anek Odia v17 and Noto Sans Devanagari v33. Anek files retain
their original variable weights. Devanagari retains every glyph and character
mapping, with its weight axis restricted to the 400–800 range used by the app. The accompanying
OFL files contain their SIL Open Font Licenses and copyright notices.

Source families: [Anek Latin](https://fonts.google.com/specimen/Anek+Latin),
[Anek Odia](https://fonts.google.com/specimen/Anek+Odia),
[Noto Sans Devanagari](https://fonts.google.com/noto/specimen/Noto+Sans+Devanagari).
The upstream projects are [EkType/Anek](https://github.com/EkType/Anek) and
[notofonts/devanagari](https://github.com/notofonts/devanagari).

`src/app/fonts.css` retains the generated face definitions and metric-adjusted
fallbacks. `src/app/fonts.ts` selects early preloads by locale: Devanagari first,
then Odia and Latin for Hindi pages; Latin and Odia for English and Odia pages.
The active script receives high fetch priority. Other subsets load
only when their glyphs are used. This avoids preloading an unused Hindi subset
on every route and lets Hindi's primary font start first. Browsers contact only
this origin; builds also no longer need Google Fonts network access.

Keep content-hashed filenames when updating fonts: Next serves WOFF2 files here
with immutable caching. Preserve the licences and Unicode ranges, update both
the CSS and preload paths, and run the existing font, visual, bundle and mobile
Lighthouse checks in all three locales.

The Devanagari asset was generated once with FontTools 4.68.0 (an asset-generation
tool, not a project or runtime dependency):

```sh
fonttools varLib.instancer source.woff2 wght=400:400:800 --output=output.woff2
```

Use the full Devanagari subset from Noto Sans Devanagari v33 as the source.
Its original size is 120,232 bytes; the restricted asset is 86,208 bytes. Preserve
its character map and glyph order, and check visual baselines at the app's used
weights after regenerating. Keep the accompanying Noto OFL copyright and licence.
