# @heach/i18n

Language support shared by the web and admin apps.

| Export                                            | Status                                                  |
| ------------------------------------------------- | ------------------------------------------------------- |
| `LOCALES`, `Locale`, `DEFAULT_LOCALE`, `isLocale` | Real: Odia, English, Hindi (I18N-01)                    |
| `createTranslator(messages)`                      | Interim: typed `t(key)` over a plain JSON messages file |
| `loadMessages(locale)`                            | Stub: rejects until Step 2                              |

Step 2 replaces the internals with ICU message catalogues per locale, locale-prefixed routes,
the missing-key check and the lint rule against hard-coded strings (I18N-02 to I18N-07).
Callers keep using `t(key)`.
