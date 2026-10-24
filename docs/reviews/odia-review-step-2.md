# Odia review: Step 2 catalogue (I18N-07)

For a native Odia speaker. Every visible string in the app shell and the sample note comes from
`packages/i18n/src/messages/or.json`; the English source is the meaning to keep. The app is used
by patients and care providers in Odisha on phones, so plain everyday Odia beats formal or
Sanskritised wording. `{name}`-style placeholders and ICU plural syntax (`{count, plural, …}`)
must stay exactly as written; only the words around them change.

Status: **not yet reviewed.** Nobody has been contacted; the owner chooses and engages the reviewer.
Checked 24 October 2026: the 34 rows below match `or.json` on `main` exactly (no key added, removed
or changed since the sheet was written); no feedback has been received.

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

A developer applies the corrections to `or.json` in a PR that links this file, keeps the
placeholders, runs `pnpm --filter @heach/i18n test` (missing-key and ICU checks) and updates the
visual baselines. Record the reviewer's name (with their permission) and date here.

| Reviewer | Date | Result |
| --- | --- | --- |
| | | |
