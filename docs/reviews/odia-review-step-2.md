# Odia review: Step 2 catalogue (I18N-07)

For a native Odia speaker. Every visible string in the app shell and the sample note comes from
`packages/i18n/src/messages/or.json`; the English source is the meaning to keep. The app is used
by patients and care providers in Odisha on phones, so plain everyday Odia beats formal or
Sanskritised wording. `{name}`-style placeholders and ICU plural syntax (`{count, plural, …}`)
must stay exactly as written; only the words around them change.

Status: **not yet reviewed.** Nobody has been contacted; the owner chooses and engages the reviewer.
Checked again 25 October 2026 on `main` `952f350`: the 34 rows below match `or.json` exactly, and
`or.json` has no key that is not listed. No feedback has been received. If a key changes before the
review, update its row first so the reviewer sees what ships.

### Cover note the owner can send

> Hello, I am building HEACH, a care-booking app for patients in Odisha. Could you check about 34
> short Odia phrases from the app's first screens? For each, please mark it OK or suggest more
> natural everyday Odia, and answer five short questions at the end. Words inside curly braces,
> like `{date}`, must stay as they are. The sheet is attached. Thank you.

## How to review

For each row, put ✅ in "OK?" if the Odia is natural and correct, or write a better wording in
"Correction". Please also answer the questions at the end.

| Key | English (source) | Odia now | OK? | Correction |
| --- | --- | --- | --- | --- |
| `app.name` | HEACH | HEACH | | |
| `home.title` | Care at home, verified and close to you | ଘରେ ଯତ୍ନ, ଯାଞ୍ଚ କରାଯାଇଥିବା ଏବଂ ଆପଣଙ୍କ ପାଖରେ | | |
| `home.findCare` | Find care | ଯତ୍ନ ଖୋଜନ୍ତୁ | | |
| `nav.label` | Main | ମୁଖ୍ୟ | | |
| `nav.home` | Home | ମୂଳ ପୃଷ୍ଠା | | |
| `nav.notes` | Notes | ଟିପ୍ପଣୀ | | |
| `nav.account` | Account | ଖାତା | | |
| `offline.banner` | You are offline. Saved pages still work; changes need a connection. | ଆପଣ ଅଫଲାଇନ୍ ଅଛନ୍ତି। ସଞ୍ଚିତ ପୃଷ୍ଠା କାମ କରୁଛି; ପରିବର୍ତ୍ତନ ପାଇଁ ସଂଯୋଗ ଦରକାର। | | |
| `state.loading` | Loading | ଲୋଡ୍ ହେଉଛି | | |
| `state.empty` | No notes yet | ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ଟିପ୍ପଣୀ ନାହିଁ | | |
| `state.error` | Something went wrong. Please try again. | କିଛି ଭୁଲ ହୋଇଗଲା। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ। | | |
| `state.retry` | Try again | ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ | | |
| `locale.label` | Language | ଭାଷା | | |
| `locale.or` | ଓଡ଼ିଆ | ଓଡ଼ିଆ | | |
| `locale.en` | English | English | | |
| `locale.hi` | हिन्दी | हिन्दी | | |
| `auth.test.title` | Test sign-in | ପରୀକ୍ଷା ସାଇନ୍-ଇନ୍ | | |
| `auth.test.hint` | Development only. Uses synthetic people, never real patients. | କେବଳ ବିକାଶ ପାଇଁ। କାଳ୍ପନିକ ବ୍ୟକ୍ତି ବ୍ୟବହାର କରେ, ପ୍ରକୃତ ରୋଗୀ ନୁହେଁ। | | |
| `auth.test.patientA` | Synthetic patient A | କାଳ୍ପନିକ ରୋଗୀ A | | |
| `auth.test.patientB` | Synthetic patient B | କାଳ୍ପନିକ ରୋଗୀ B | | |
| `auth.test.signIn` | Sign in | ସାଇନ୍ ଇନ୍ କରନ୍ତୁ | | |
| `auth.signOut` | Sign out | ସାଇନ୍ ଆଉଟ୍ କରନ୍ତୁ | | |
| `auth.signedOut` | You are signed out. | ଆପଣ ସାଇନ୍ ଆଉଟ୍ ହୋଇଛନ୍ତି। | | |
| `sample.note.title` | My notes | ମୋର ଟିପ୍ପଣୀ | | |
| `sample.note.label` | New note | ନୂଆ ଟିପ୍ପଣୀ | | |
| `sample.note.hint` | Up to 2,000 characters. Only you can read it. | ୨,୦୦୦ ଅକ୍ଷର ପର୍ଯ୍ୟନ୍ତ। କେବଳ ଆପଣ ଏହା ପଢ଼ିପାରିବେ। | | |
| `sample.note.save` | Save note | ଟିପ୍ପଣୀ ସଞ୍ଚୟ କରନ୍ତୁ | | |
| `sample.note.saved` | Note saved | ଟିପ୍ପଣୀ ସଞ୍ଚୟ ହେଲା | | |
| `sample.note.tooLong` | Keep the note under 2,000 characters. | ଟିପ୍ପଣୀ ୨,୦୦୦ ଅକ୍ଷର ଭିତରେ ରଖନ୍ତୁ। | | |
| `sample.note.count` | {count, plural, =0 {No notes} one {# note} other {# notes}} | {count, plural, =0 {କୌଣସି ଟିପ୍ପଣୀ ନାହିଁ} one {#ଟି ଟିପ୍ପଣୀ} other {#ଟି ଟିପ୍ପଣୀ}} | | |
| `sample.note.createdAt` | Written on {date} | {date} ରେ ଲେଖାଯାଇଛି | | |
| `ui.close` | Close | ବନ୍ଦ କରନ୍ତୁ | | |
| `ui.otp.label` | One-time password | ଏକ-ଥର ପାସୱାର୍ଡ | | |
| `ui.otp.digit` | Digit {index} of {total} | {total}ରୁ {index} ନମ୍ବର ଅଙ୍କ | | |

## Questions for the reviewer

1. Is the tone right for an elderly patient reading on a small phone screen: polite but plain?
2. Is "ଟିପ୍ପଣୀ" the word you would use for a personal health note, or is something else clearer?
3. Do the offline and error messages tell the reader what to do next, in words they would use?
4. Should medical terms (for example "doctor", "nurse", "physiotherapy") be in Odia script,
   transliterated English, or both? This choice will apply to every later screen.
5. Does any string read as a machine translation?

## After the review

### Feedback needed back

The review is complete when the owner has all of these from the reviewer and pastes them into a
Claude session or a PR:

1. Every one of the 34 rows marked ✅ or given a correction. Blank rows count as not reviewed.
2. Written answers to the five questions. Question 4 sets the rule for every later screen, so it
   needs a clear choice: Odia script, transliterated English, or both.
3. The reviewer's name and the date, and whether the name may be recorded here. Without
   permission, record "native speaker chosen by the owner".

Partial feedback is applied like full feedback, but the review stays open until all 34 rows are
covered.

### Applying it (developer)

1. On a branch `fix/i18n-odia-review`, change only the values in
   `packages/i18n/src/messages/or.json`. Keep keys, `{placeholders}` and the ICU plural skeleton
   exactly as they are. Copy each correction into this sheet's "Odia now" column as well, so the
   sheet keeps matching the catalogue.
2. `pnpm --filter @heach/i18n test`: the missing-key, ICU and catalogue checks (I18N-02.2,
   I18N-07.1).
3. Update the visual baselines (UX-03.1, TS-07.1) with the Linux Playwright container, as in
   [local development](../local-development.md). Look at the new Odia screenshots before you
   commit them.
4. `pnpm check`, then a PR that links this file. Record the answer to question 4 as a rule in
   `packages/i18n/README.md`.
5. In the same PR, fill the table below. Mark I18N-07 Done in
   [implementation status](../implementation-status.md) only if no gap remains. Close open item 2
   in the [acceptance matrix](../step-2-acceptance-matrix.md) with the date.

| Reviewer | Date | Result |
| --- | --- | --- |
| | | |
