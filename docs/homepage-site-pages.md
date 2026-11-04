# Homepage and site pages

Owner approved all recommended Phase 1 answers on 1 November 2026. Scope: A–D of the attached
homepage plan. One branch/PR; no merge or deployment. Reference boards were decoded into
`/private/tmp/heach-boards-zw_vyay5`; the untracked mockup must never be committed.

Chosen layouts: Desktop home combining A/B/C; Booking A with desktop summary; Records A
with desktop health profile; Onboarding A with desktop step sidebar. Use home visits in examples.

## Data classification and threat model (DC, SO-01)

| Field or state | Class | Handling |
| --- | --- | --- |
| Approved helpline, hours, staffed languages, reply days, support email, legal company name/address, CIN | Public | Explicit `SITE_*` allowlist; validated; no secrets; absent or invalid values visibly pending |
| Grievance officer business contact, response deadlines and data-protection contact | Public after approval | `SITE_GRIEVANCE_*` and `SITE_DATA_CONTACT_EMAIL`; the officer shows only when all five fields are set; pending owner/lawyer confirmation |
| Approved service descriptions, catalogue prices, qualifications, coverage | Public | Published provider/catalogue data only; never invent availability or prices |
| Published counts and reference date | Public after approval | Hidden until real data exists; no synthetic business claims |
| Published review first name, service, text | Public only after approval/consent | Hidden until real reviews exist; never include condition or other health details |
| Source reviews before approval | Confidential; health details Restricted | Existing review authorization/moderation; do not copy into marketing or logs |
| Search PIN, service intent, free text, fee/rating and availability filters | Confidential; potential health terms Restricted | Memory and POST bodies only; never browser URLs, storage, logs or analytics |
| Selected linked-person ID/name and next booking | Confidential | Existing authenticated APIs and server object authorization; memory only |
| Vault query and record/history content | Restricted | Existing authorized, audited, encrypted vault; query in POST body |
| Configuration before publication | Internal | Owner confirms before publication; no secrets in public config |

Primary threats: exposing private cards during session restoration; search/health terms in access
logs; incorrect provider/price claims; admin content injection; links to unavailable pages; feature
flag bypass; identity or booking mutations without server authorization. Mitigations: private
components mount only when signed in; public search POST; existing role/object guards; plain-text
content rendering; shared allowlists; four-service allowlist; staging/production flag restrictions
stay intact. API writes still require their existing role, fresh OTP/TOTP and audit checks. Private file
links use opaque, revocable Blob URLs instead of embedding medical file bytes in data URLs.
Downloads dispose those URLs when the record leaves the screen. Resource reads hide a previous
person/filter result immediately and discard stale responses. Reloading an "any provider"
booking asks for the PIN again rather than persisting it in a URL or browser storage.

No real provider, patient, review or booking fixtures are introduced. Public contact values are
configuration, not new patient fields. Native translations and legal wording are drafts (FU-41/42).
FU-43 lists operational placeholders. Statistics and reviews remain hidden (FU-44). `SITE_METRICS` accepts only approved live counts
with a valid reference date. `SITE_REVIEWS` requires approval, consent confirmation and confirmation
that health details were removed, plus three or four items containing only a first name, one of the
four services, a review excerpt and its language. Source operational counts remain Internal;
source reviews are Confidential (health details Restricted). Approval metadata is Internal and is
not sent to the browser. The owner must check the actual source and consent before setting these
values; the boolean configuration is a publication control, not evidence that a review happened.
Unset or malformed values publish nothing. `SITE_*` public values pass through the dev web
container configuration; no deployment or live configuration was performed.

## Verification record

Local implementation and verification complete on 2 November 2026. This does not close the launch gates: Manual native-language, lawyer,
real-phone and screen-reader reviews remain external follow-ups and must not be claimed done.

### Defect repair round (2 November 2026)

- D1: same-key refresh retains the ready resource; changed people/filters still hide old data,
  late reads are discarded and disabled reads send nothing. Regression tests cover deferred
  responses, refresh replacement, child success messages and input focus. Call sites include
  team, people, bookings, plans, provider work/listings, lab orders and vault.
- D2: footer links have minimum dimensions of 48 px. Booking review and onboarding step changes
  scroll to the top and focus the new step, so a shrinking form cannot leave footer links obscured
  by the sticky header. Browser regressions check focus, scroll position, axe and link dimensions.
- D3: desktop timeline metadata is visible beside each record title instead of inside collapsed details.
  Visual review also caught the inherited narrow form width clipping table actions: desktop booking,
  vault and onboarding layouts now use the available page width, with a table-overflow regression.
- D4: onboarding sets a localized document title for each step; tests cover or/en/hi.
- D5: static home sections, service copy, headings, FAQ and footer links are server components;
  the session boundary accepts server-rendered children. Public prices are a small client island.
  Page-scoped client message props exclude legal bodies, service descriptions and FAQ bodies.
  The measured home entries are 153,373 bytes gzipped in each locale; provider entry is 154,514 bytes,
  below the unchanged 174,080-byte limit.
- D6: session restoration shows a neutral shell with the server-rendered public markup hidden.
  Private cards mount after authentication; public prices are disabled during restoration.
- D7: catalogue fallback dates are null in the API and web. Undated content has a localized draft
  label and no Updated line. Server content is displayed without a duplicate browser fetch;
  dev web runtime uses `API_ORIGIN=http://api:3001`.
- D8: POST coverage reads approved active listings and service areas, returns only the four MVP
  services, and uses the shared address limiter. Each service has specific FAQ keys in all three
  languages. Saved care PINs load per person; route and tile tests exclude deferred services.
- D9: the search test uses a unique synthetic provider name, so unrelated cheaper fixtures cannot
  push it outside the SQL LIMIT 50. Product ordering and limit remain unchanged.
- D10: tests snapshot and restore the affected content pages and notification overrides, including
  original timestamps. The loopback-only repair removed 21 rows titled `Approved synthetic title`
  or `Synthetic title` from the owner's local database. No cloud operation was performed.
- D11: typed mock arguments, readonly Blob URL fixtures and formatting are repaired. Repository
  checks pass without changing assertions, lint rules or hooks.

Saved care PINs (migration 0018) are Confidential. Account ID, linked-person ID and PIN stay in
POST/PUT bodies and the authenticated database; no browser persistence, URLs, logs or analytics.
Saving a home search remembers only its PIN for the selected recipient. Queries and saves enforce
owner access; deleting a linked person cascades their saved PIN, and PR-04 export includes these
preferences. Existing account deletion remains governed by FU-31. Public coverage responses contain
only service names and a served boolean; the requested PIN remains Confidential.

Repository gate: `pnpm check` passed 37/37 tasks, including web 214 tests (34 files), API unit
175 (38), admin 31 (9), UI 90 (14), i18n 14 (5), logger 43 (2), crypto 15 (3), flags 5 (1),
types 2 (1) and scripts 46. `pnpm format:check` is clean; `pnpm secrets:scan` scanned 241 commits
with no leaks. `node /private/tmp/heach-defects-integration.mjs --repeat=2` passed 43 files / 358
tests twice on the same temporary database (93.74 s and 95.65 s); its database and isolated Redis
data were removed afterward.

Final browser commands used the temporary task runner, a fresh local API on :3201, web on :3200
and admin preview on :3220. The API used its own PostgreSQL database and initially empty, leased
Redis database; both were removed at shutdown. General address/device allowances were raised for
synthetic fixtures; per-number OTP limits stayed at 5/hour and 10/day. Tests used one worker to
avoid resource contention; concurrent-session tests retain their own simultaneous operations.
Owner servers on :3000, :3001, :3101 and :13000 were neither stopped nor restarted.

| Command | Final result |
| --- | --- |
| `node /private/tmp/heach-defects-e2e.mjs --no-api --ignore-snapshots --workers=1` | 127 passed, 137 API-dependent skips; 26.4 s |
| `node /private/tmp/heach-defects-e2e.mjs --ignore-snapshots --workers=1` | 241 passed, 23 mode/project-specific skips; 3.7 min |
| `node /private/tmp/heach-defects-e2e.mjs --admin --workers=1` | 14 passed; 9.4 s |
| `node /private/tmp/heach-defects-e2e.mjs --linux e2e/site-pages.spec.ts e2e/shell.spec.ts --update-snapshots=all --workers=1` | Linux Playwright v1.63.0-noble: 102 passed, 3 expected skips |
| Same Linux command without `--update-snapshots=all` | 102 passed, 3 expected skips; 37.2 s |
| `node /private/tmp/heach-defects-e2e.mjs --smoke` | 118 checks passed across or/en/hi |
| `pnpm --filter @heach/ui build-storybook` | Passed; 57 new story variants also covered by component axe tests |

All 46 changed PNGs were viewed: public shell and bottom navigation, patient home, Booking A,
Records A and Onboarding A in or/en/hi on mobile, tablet and desktop. Lavender/peach surfaces,
Headings (bilingual at the time; single-language since 3 November 2026, see below), service tiles, desktop summaries/sidebar and visible record metadata
match the selected reference layouts. The narrow desktop table found during review was fixed
before the final complete verification pass. Snapshot thresholds and axe rules are unchanged.

Smoke used fresh synthetic OTP patients and a temporary super admin. It checked every footer,
service and join route (200), doctor route (404), SSR hero, four services, hidden statistics/reviews,
published-listing coverage through POST without a PIN in the URL, admin-published content with no
browser refetch, labelled undated drafts, no visible marketing during patient session restoration,
no patient-only public-price request, and no page overflow at 360 px and 200% text zoom. Temporary
content overrides were restored with original timestamps. The smoke harness was rerun after fixing
its missing Playwright base URL; no application change or assertion relaxation was needed.

Final bundle measurement (`node /private/tmp/heach-defects-e2e.mjs --measure`): `/or`, `/en` and
`/hi` each 153,373 bytes gzipped; `/or/provider` 154,514 bytes. The full browser suite also checks
`/or/notes` and `/or/sign-in` against the same 174,080-byte limit. Own servers were stopped and
`pnpm --filter @heach/web build` restored the normal build without the test API rewrite.

FU-41 (native review), FU-42 (legal review), FU-43 (operational contacts, company/grievance details,
launch PINs, prices and tagline) and FU-44 (real approved metrics/reviews) remain open. FU-45 tracks
the lower fee bound still missing from SD-03. Real-phone and screen-reader checks remain external;
this record does not claim them completed.

Verification runner: `pnpm check` now limits Turbo to two concurrent tasks so CPU-heavy native
password tests do not contend with every build and UI suite at once. Assertions, timeouts, axe
rules, the 170 KB budget and git hooks are unchanged. Script test files run serially so their
load generators do not compete with the half-second load-test fixture. The sandbox needs access to the existing
SWC native cache; checks are run with the required execution permission.

### CI follow-up (2 November 2026)

The first CI run passed Checks (including integration/coverage), API-backed E2E, API image, deploy
bundle, infra, implementation-status and secret scanning. Two failures were fixed before retrying:

- Static analysis rejected dynamic SQL identifiers in the content restoration helper. It now selects
  complete fixed SQL statements for each of the two supported tables, with all values parameterized.
  The full pinned Semgrep command (TypeScript, Node, React and repository policies) passes locally.
  Both affected integration files pass twice: 6 tests per run; temporary PostgreSQL/Redis data removed.
- Lighthouse mobile performance was below 90 in Odia/Hindi. The session check initially omitted the
  sign-in control, then wrapped the header when inserting it, shifting the whole page. A hidden,
  non-interactive slot now reserves the same space during checking, without revealing session data.
  New browser tests hold restoration and compare header height before/after: 9 passed across all
  locales/viewports. A unit regression verifies the placeholder has no link target or accessible action.
  Local Hindi Lighthouse improved to 98 with CLS 0, using the existing mobile settings. The 90-point
  threshold, other assertions and all scanner rules remain unchanged.

`pnpm check` remains green (37/37 tasks; web unit count now 215); `pnpm format:check` is clean.
The follow-up changes no requirement status or module total. CI confirmation is recorded on PR #125.

CI retry confirmation: the static-analysis and Lighthouse smoke jobs both passed on `c0e9526`,
as did API-backed E2E, deploy bundle, image, infra and secrets. The coverage-instrumented unit
run then exposed an asynchronous assertion in the existing onboarding title test: it read
`document.title` immediately after a DOM update, before the passive effect ran. The regression
now waits for the same exact localized title after each step and resets the document title
between cases. No assertion, timeout, coverage threshold or product behavior changed.
The nine onboarding tests pass with V8 coverage enabled.

The next CI run passed coverage/Checks but Hindi Lighthouse scored 87, despite passing in
the preceding run with identical application code. A Linux Playwright Chromium reproduction
using the same mobile settings scored 100 with CLS 0. CI now retains `.lighthouseci` reports
on both success and failure so runner-specific FCP/LCP, blocking time and shift data can be
reviewed. This adds diagnostics only; the 90-point threshold and three-run aggregation stay intact.

### Requested fresh build and full test round (2 November 2026)

The owner requested one fresh build/check round before committing and updating the PR. This
round tested application commit `16dd56a`; no application code, dependencies, test assertions,
timeouts, snapshots, scanner rules or budgets needed changing. The resulting documentation
commit records this evidence and the moderate dependency findings in FU-46.

| Gate / actual command | Result |
| --- | --- |
| `pnpm exec turbo run lint typecheck test build --concurrency=2 --force --output-logs=errors-only` | 37/37 tasks, **0 cached**, 1 min 48 s; all apps/packages built and all 590 unit/component tests passed |
| `pnpm check` | Passed, including script lint and all 46 script tests; 636 unit/component/script cases in total |
| `pnpm format:check` / `pnpm secrets:scan` | Clean |
| `node /private/tmp/heach-defects-integration.mjs --repeat=1` | 43 files / 358 passed; 170.43 s; isolated PostgreSQL and Redis data removed |
| `node /private/tmp/heach-defects-e2e.mjs --no-api --ignore-snapshots --workers=1` | 136 passed, 137 expected API-dependent skips; 48.1 s |
| `node /private/tmp/heach-defects-e2e.mjs --ignore-snapshots --workers=1` | 250 passed, 23 expected mode/project skips; 5.4 min |
| `node /private/tmp/heach-defects-e2e.mjs --admin --workers=1` | 14 passed; 16.0 s |
| `node /private/tmp/heach-defects-e2e.mjs --linux e2e/site-pages.spec.ts e2e/shell.spec.ts --workers=1` | 111 passed, 3 expected skips; 1.2 min; existing Linux snapshots matched without updates |
| `node /private/tmp/heach-defects-e2e.mjs --smoke` | 118 passed across or/en/hi, including real coverage, admin publication, session restoration, 360 px and 200% text zoom |
| `pnpm --filter @heach/ui build-storybook` | Production build passed |
| `pnpm --filter @heach/types check` | Generated OpenAPI/client types are current |
| Pinned Semgrep 1.179.0, TypeScript/Node/React plus `security/semgrep/heach.yml`, severity ERROR | Passed |
| `pnpm audit --audit-level high --json` | Passed: zero high/critical findings. Full `pnpm audit --json` reports three moderate advisories, recorded in FU-46 |
| Linux Playwright 1.63.0-noble, `lhci autorun` with the repository assertions and three samples per locale | All three configured performance assertions passed; nine reports retained in `/private/tmp/heach-final-lighthouse` |

Unit totals: web 215, API 175, admin 31, UI 90, i18n 14, logger 43, crypto 15, flags 5, types 2;
script tests 46. Browser modes cover mobile, tablet and desktop in all three locales.

The Lighthouse wrapper `/private/tmp/heach-final-lighthouse-linux.cjs` copies the repository
configuration, changes only collection URLs to the temporary server through a localhost proxy
(:4200 to :3200), removes the command that would start a server on :3100, and writes reports to
a temporary directory. It uses the container's Playwright Chromium through `CHROME_PATH` and
the same CI sandbox flags. The 90-point assertion, `median-run` aggregation, mobile settings and
three-run sample count are unchanged. Raw scores were Odia **83, 97, 99**, English **100, 100,
100**, Hindi **87, 91, 91**; the configured representative-run assertions passed. These are raw
samples, not a claim that every individual sample scored 90.

Fresh initial-JS gzip measurements: `/or`, `/en`, `/hi` each **153,396 bytes**; `/or/provider`
**154,537 bytes**. All remain below the unchanged **174,080-byte** budget.

Test API/web/admin used only :3201/:3200/:3220, with fresh synthetic identities and normal
per-number OTP caps. All temporary servers, the browser database and leased Redis data were
removed; the normal web build was restored. Owner services on :3000/:3001/:3101/:13000 were not
restarted. No mockup, secret, generated report or test data is included in the commit.

Requirement statuses and module totals do not move in this verification round. FU-41–45 remain
open; FU-46 adds triage of the three moderate `qs`, `minimatch` and `glob` advisories.

## Single-language headings (3 November 2026)

English and Hindi pages showed Odia headings and service-tile titles, with the selected language as
a smaller grey caption beneath. `Bilingual` and `ServiceTiles` always rendered the Odia catalogue,
and `.bilingual__secondary` shrank the selected language. That breaks I18N-01/02: a page shows the
language its route names. The site now renders headings and tiles from the route's catalogue only;
`Bilingual` and its stories are removed. English pages preload only the Latin font and Hindi pages
Devanagari and Latin, because no Odia is shown there. The Odia face still loads on demand by
unicode-range, for example for "ଓଡ଼ିଆ" in the open language menu. Guards: a unit test renders the
public home, patient home, join page and every service page in en and hi with no Odia script, and an
E2E test (`shell.spec.ts`, I18N-01) checks the rendered `main` text and loaded fonts in a browser.

## Contact page (4 November 2026)

Built from a study of NHS.uk, Portea, Tata 1mg and Practo contact pages and the Indian disclosure
rules (IT Rules 2021 r. 3(2), Consumer Protection (E-Commerce) Rules 2020 r. 4, DPDP Rules 2025
r. 9). `/{locale}/pages/contact` shows, in order: the emergency banner; the admin-edited intro
(AD-09); "What do you need help with?" with six routes; talk to us (call button, hours, staffed
languages, email, reply time, and a note not to email prescriptions or reports); the grievance
officer with deadlines, three complaint steps and a link to the grievance page; the
data-protection contact; company details with a plain maps link (no embedded map: no third-party
script and nothing sent until tapped); and the FAQ preview.

Decisions: booking problems and safety concerns route to the signed-in booking flow (RF-03), so
the page has no public free-text form and health details never travel by email; WhatsApp stays
unoffered. Every value is public configuration (`.env.example` lists the new `SITE_*` names);
malformed hours, counts or languages count as unset, and each unset group shows a marked pending
notice. The Odia and Hindi `contact.*` keys are drafts for native review (FU-41); the deadlines
and the grievance and data contacts wait for the lawyer (FU-42) and the owner (FU-43).

Verification: unit tests for config parsing and the pending and confirmed page states with axe;
`site-pages.spec.ts` checks the banner, six routes returning 200, pending notices, axe, 200% text
and pseudo-localisation on mobile, tablet and desktop in or, en and hi.
