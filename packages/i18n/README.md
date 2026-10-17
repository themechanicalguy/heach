# @heach/i18n

Language support shared by the web and admin apps (I18N-01 to I18N-07).

| Export                                            | What it does                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `LOCALES`, `Locale`, `DEFAULT_LOCALE`, `isLocale` | Odia (default), English, Hindi                                                          |
| `CATALOGUES`, `messagesFor(locale)`               | ICU catalogues in `src/messages/{or,en,hi}.json`; English is the reference shape        |
| `createTranslator(messages, locale)`              | Typed `t(key, values?)`; formats ICU `{arg}`, `plural` (with `=N` and `#`) and `select` |
| `formatCurrency(rupees)`                          | `₹1,23,456.50` in every language (Indian grouping, Latin digits)                        |
| `formatDate(date, locale)`                        | Medium date in the user's language, India time                                          |
| `findCatalogueProblems(catalogues)`               | Missing or extra keys, invalid ICU, mismatched arguments; a test runs it in CI          |

## Adding text

Add the key to all three files in `src/messages/` in the same change. The catalogue test fails
when a key is missing in any locale (I18N-07.1). Odia and Hindi text needs review by a native
speaker before release.

## Adding a locale

Add `src/messages/<code>.json`, the code to `LOCALES` and the import to `src/catalogue.ts`.
The web app's routes (`/[locale]`) pick it up without other changes (I18N-01.1).
