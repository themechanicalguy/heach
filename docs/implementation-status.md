# Implementation status

- **Last updated:** 18 October 2026: approved dependency additions built (Caddy rate limit, local Prometheus and Grafana dashboard, GlitchTip source maps); live dev checks wait for the infra apply ([log](step-2-progress.md))
- **Current step:** Step 2 of the [implementation guideline](mvp-v1-implementation-guideline.md): engineering done, exit pending owner actions

This page separates what is built from what is only specified. The
[requirements](mvp-v1-requirements.md) say _what_ to build and the
[guideline](mvp-v1-implementation-guideline.md) says _in what order_; neither tracks progress. Step specs in [`docs/specs/`](specs/README.md) define when an item is
Done: every acceptance criterion passes.
Update this page in the same pull request that changes a status; the pull request template
checks for it (rule in [`CLAUDE.md`](../CLAUDE.md#working-rules)).

| Status | Meaning |
| --- | --- |
| ✅ Done | Built, tested in CI, meets the requirement as written |
| 🟡 Partial | Some of it is built; the gap is stated |
| ⬜ Not started | Specified only |

## Step 1: Repository and app initialization

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 1 | Repository with branch protection on `main` | 🟡 Partial | GitHub Free cannot protect branches; replaced by PR-only process and a pre-push hook ([ADR 0004](adr/0004-github-free-no-branch-protection.md)). Signed commits not required |
| 2 | Monorepo, pnpm + Turborepo, Node LTS, TypeScript strict | ✅ Done | [ADR 0001](adr/0001-monorepo-and-stack.md) |
| 3 | App shells `web`, `admin`, `api` | ✅ Done | API has `/healthz`, `/readyz`, OpenAPI |
| 4 | Shared packages `ui`, `i18n`, `config`, `types`, `crypto`, `logger` | ✅ Done | Scaffolds; `crypto` is an interface only (Step 2) |
| 5 | Local services with one command | ✅ Done | `pnpm dev:up` ([local development](local-development.md), [ADR 0002](adr/0002-local-services.md)) |
| 6 | Commit hooks and conventional commits | ✅ Done | [ADR 0003](adr/0003-quality-gates-without-new-dependencies.md) |
| 7 | CI pipeline with caching; PR template with definition of done | ✅ Done | `.github/workflows/ci.yml`, `.github/pull_request_template.md` |
| 8 | Cloud in an India region with IaC: dev, staging, production | 🟡 Partial | Dev stack applied (one lean host, ADR 0008): ports 80/443 only, admin via Session Manager, 4 KMS keys, uploads bucket, nightly snapshots. Region pinned to `ap-south-1`. No managed databases, load balancer or separate accounts ([cloud setup](cloud-setup.md), ADRs [0005](adr/0005-aws-dev-environment.md), [0006](adr/0006-infra-layout-and-state.md)). Staging and production folders exist but are not provisioned |
| 9 | Auto-deploy to dev and staging; preview deploy per PR | 🟡 Partial | Deploy to dev on merge: OIDC, image scan gate, SSM deploy, smoke test, rollback to the previous tag. No staging, no previews (replaced by dev only, ADR 0009). Re-runs of the same commit skip the build because ECR tags are immutable. First green Deploy dev on `main`: `5f5c956`, 18 October (scan gate passed, smoke test passed). Gap: it logged "Previous tag: none", so rollback had no target on that run |
| 10 | README, contributing guide, ADR template, `docs/` | ✅ Done | |

### Step 1 exit criteria

Walked through on 17 October 2026, with the changes in [ADR 0009](adr/0009-aws-credits-and-restricted-pilot.md).

| Criterion | Status | Evidence |
| --- | --- | --- |
| New developer runs all three apps locally within 30 minutes | ✅ Done | `pnpm dev:up` ([local development](local-development.md)); CI's E2E smoke job starts all three from a clean checkout. Not yet timed on a fresh machine |
| Merged PR reaches staging without manual steps | 🔁 Replaced by dev only, see ADR 0009 | Deploy dev runs after CI on `main`: first deploy of `52272c8990c8` answered on `https://15.252.65.98/api/readyz` (PostgreSQL and Redis ok). Scan gate, smoke test and rollback added in B3 (PR #17). Merge of PR #30 deployed `5f5c956ff9a2` with scan, deploy and smoke test passing ([run](https://github.com/themechanicalguy/heach/actions/runs/39063937336)) |
| `main` protected; pipeline blocks a failing build | 🟡 Partial | CI fails on a failing build (7 jobs). GitHub branch protection returns HTTP 403 on the private Free repository ([ADR 0004](adr/0004-github-free-no-branch-protection.md)); commands ready in [environments](environments.md#branch-protection-on-main) |
| Third-party applications submitted and tracked | 🟡 Partial | Tracked: issues #19 to #25 (label `partner-onboarding`). Submitting them is the account holder's task |
| Credit-expiry alerts active and tested, including simulated levels (playbook) | 🟡 Partial | github-oidc applied (18 October plan: no changes); GitHub variables set; real run reports ok, $120 of $120; simulated Watch, Plan, Act and Emergency each updated issue #29. All alert paths (levels, plan not ACTIVE, burn rate, failed check) verified locally with stubbed `gh`/`aws`; burn rate now alerts on its own. SNS subscription confirmed; labelled test alert sent 18 October ([run](https://github.com/themechanicalguy/heach/actions/runs/39065434862)). Pending: email receipt (owner), second address, three scheduled daily runs (18–20 October). `dev-sleep`/`dev-wake` tested 18 October: host stopped and `/api/healthz` stopped answering; after wake the smoke test passed |
| ADR lists every requirement relaxed for the pilot (playbook) | ✅ Done | [ADR 0009](adr/0009-aws-credits-and-restricted-pilot.md) |

## Requirements by module

Every module not listed under "Partial" below is ⬜ Not started.

| Module | IDs | Done | Partial | Not started | Planned in step |
| --- | --- | --- | --- | --- | --- |
| DC Data classification | DC-01 (Step 2 spec) | 1 | 0 | 0 | 2 |
| EN Encryption | 13 | 4 | 8 | 1 | 2 |
| SE Access control and audit | 9 | 1 | 4 | 4 | 2, 3, 6 |
| PR Privacy and consent | 7 | 0 | 2 | 5 | 3 |
| SO Secure development and operations | 10 | 3 | 4 | 3 | 2, 6, 10 |
| PF Performance | 7 | 4 | 2 | 1 | 2 |
| A11Y Accessibility | 7 | 0 | 0 | 7 | not mapped (see gaps) |
| I18N Multi-language | 7 | 5 | 1 | 1 | 2 |
| TS Testing | 9 | 4 | 3 | 2 | 2 |
| LM Logging and monitoring | 9 | 1 | 6 | 2 | 2 |
| UX User experience | 8 | 5 | 0 | 3 | 2 |
| AC, PO, KY, AD-01 to 03, 11, 12 | 6 + 7 + 9 + 5 | 0 | 0 | all | 3 |
| SL, AV, SD, AD-04 | 9 + 4 + 5 + 1 | 0 | 0 | all | 4 |
| BK, PY, NT, AD-05, AD-07 | 9 + 7 + 3 + 2 | 0 | 0 | all | 5 |
| OC, HS, RF, AD-06 | 7 + 6 + 3 + 1 | 0 | 0 | all | 6 |
| IC, LB, AD-13 | 10 + 11 + 1 | 0 | 0 | all | 7 |
| MV, AD-15 | 16 + 1 | 0 | 0 | all | 8 |
| PK, RR, AD-08 to 10, 14, 16, 17 | 8 + 8 + 6 | 0 | 0 | all | 9 |

No functional requirement (journeys J1 to J9) is implemented yet.

Counts after Step 2 (18 October 2026), strict: Done only where the requirement is met as
written today, not just its Step 2 part.
- **EN:** Done 03, 06, 09, 13. Partial 01, 02, 04, 05, 07, 10, 11, 12 (live checks wait for the
  apply). Not started 08.
- **SE:** Done 02. Partial 04, 05, 07, 09.
- **SO:** Done 01, 03, 05. Partial 06, 07, 08, 10.
- **PF:** Done 02, 03, 05, 06. Partial 01, 07 (shell only, no queued actions).
- **I18N:** Done 01, 02, 03, 04, 06. Partial 07 (native review). Not started 05.
- **TS:** Done 01, 02, 03, 07. Partial 05, 06, 09.
- **LM:** Done 02. Partial 01, 03, 04, 05, 07, 09.
- **UX:** Done 01 to 05. Not started 06 to 08.

## Step 2: Secure foundation and quality gates

[Spec](specs/step-02-secure-foundation.md). Evidence per acceptance criterion is in the
[Step 2 log](step-2-progress.md).

| Part | Status | Notes |
| --- | --- | --- |
| Engineering (code, tests, CI gates, ADR 0010, runbooks) | ✅ Done | PRs #34 to #43 merged with CI green. The Odia note flow runs end to end in CI behind Caddy: encrypted, owner only, audited, absent from logs |
| Infra apply and live dev checks | ⬜ Blocked | AWS sign-in expired. Pending: dev and bootstrap applies, then EN-01.3, EN-04.2 plan, EN-10.3 listing, EN-10.4 host restore, EN-12.2 rotation, SO-08.3 and LM-07.1 live alerts. Until then Deploy dev stops at its preflight and dev keeps its previous version |
| Owner decisions on dependencies | ✅ Done | Approved 18 October and built: `caddy-ratelimit` (SO-08.2, CI floods the deploy bundle), Prometheus and Grafana local only (LM-05.1 record), source maps to GlitchTip (LM-03.1 record). `@sentry/cli` not used: its maintained versions are FSL-1.1-MIT, not open source (D4); `scripts/upload-source-maps.mjs` uses GlitchTip's API instead |
| Native Odia review (I18N-07) | ⬜ Owner | New keys in `packages/i18n/src/messages/or.json` |
| Lawyer review (D6) | ⬜ Owner | Step 2 exit criterion |

### Partial requirements

| ID | What exists | What is missing |
| --- | --- | --- |
| EN-01 | TLS on 443 through Caddy's internal CA, HSTS header, port 80 redirects to HTTPS. PostgreSQL and Redis accept TLS only (private CA, `deploy/dev/make-certs.sh`); plaintext refused locally, in CI and on the dev host bundle | Publicly trusted certificate; `openssl s_client` record on the dev host (EN-01.3) |
| EN-02 | Encrypted EBS disk and snapshots, state bucket, uploads bucket (SSE-KMS), ECR images | Encrypted log store; queues and search do not exist yet |
| EN-04 | Customer managed KMS keys in Mumbai; host role limited to `GenerateDataKey` and `Decrypt`. `@heach/crypto` envelope encryption, API KMS adapter, `app.data_key` table | Infra change not yet applied (AWS sign-in pending) |
| EN-06 | One key per data domain (health, identity, payments, documents) per environment, yearly rotation | Only dev exists; the app does not use the keys yet |
| EN-07 | Private, versioned uploads bucket, SSE-KMS (documents key), public access blocked, TLS only | Per-object keys, virus scanning, signed URLs (Step 2 onward) |
| EN-10 | Nightly EBS snapshots kept 7 days, encrypted. Migrations run forward from empty in CI; separate migrator, API and audit-owner roles. Code for a backup KMS key, private backups bucket, nightly dump timer, weekly off-account pull script and restore check; local restore record | Infra not applied (AWS sign-in); no dev-host dump or restore record yet |
| EN-12 | gitleaks in hooks and CI; generated passwords in SSM Parameter Store; CI deploys over OIDC without keys; the API reads its secrets from Parameter Store at start-up; rotation runbook | Rotation run once in dev (EN-12.2), blocked on the infra apply; Secrets Manager revisited at the pilot (D2) |
| SE-04 | Admin has no public port; reached only through Session Manager port forwarding (IAM sign-in with MFA) | In-app MFA, short sessions, export controls (no admin login exists yet) |
| PR-06 | `naming` module rejects regions outside India; everything in `ap-south-1` | Data processing agreements with third parties |
| PR-07 | Logger redacts personal keys | No analytics or monitoring tools yet |
| SO-03 | Secret scan, `pnpm audit` (high blocks), ECR scan on push; Semgrep CE and Trivy in CI on every PR, each scanner proven by a fixture | Dynamic scan and penetration test (SO-04, before pilot) |
| SO-06 | Access only through SSM Session Manager, no SSH | Bastion or zero-trust proxy for production, quarterly review |
| SO-07 | Synthetic-data rule in docs and CLAUDE.md | Enforcement once real data exists |
| I18N-01 | Locales `or`, `en`, `hi` defined; Odia default | Locale-prefixed routing, adding a language without code change |
| I18N-02 | ESLint fails on hard-coded JSX strings and text props; ICU catalogues for or, en, hi with plurals; locale routes `/or`, `/en`, `/hi`; bundled Odia and Devanagari fonts | Native Odia review of the text (I18N-07) |
| TS-01 | Vitest in every package and app | 80% coverage threshold on changed code |
| TS-03 | API integration tests against real PostgreSQL and Redis in CI (`/healthz`, `/readyz`) | Every endpoint (none beyond health yet) |
| TS-05 | E2E smoke for web and admin on every PR (Chromium) | Nightly full suite; mobile and tablet projects |
| LM-02 | `@heach/logger` masks personal and Restricted keys and mobile numbers in values; ESLint fails on `console.*`; correlation and trace IDs on every API line; OpenTelemetry traces to Jaeger locally; Grafana dashboard and GlitchTip in the local `observability` profile | Nothing central on the dev host (ADR 0010) |
| UX-01 | App shell with header, language switch, offline banner and bottom navigation on `/or`, `/en`, `/hi`. `@heach/ui`: tokens with three breakpoints, Button, TextField, OtpField, Card, Sheet, Table, Toast, BottomNav, loading/empty/error/offline states; Storybook built in CI; axe on every component and story | Tailwind not yet used (plain CSS on tokens); colour contrast checked only in the browser |

## Documentation gaps found in review

Found while building this page. Open items need a decision before the source docs change; under
[ADR 0007](adr/0007-spec-driven-development.md) each is settled in the spec of the step it
affects at the latest (for example item 6 in the Step 2 spec).

1. **37 requirement IDs are not assigned to any guideline step:** all of A11Y-01 to 07; EN-01, 02,
   07, 10, 13; SE-01, 03, 04; PR-02, 03, 05, 06, 07; SO-02, 04, 06, 07, 09, 10; TS-08, 09;
   LM-08, 09; UX-06, 07, 08; AC-05; BK-06; LB-09; RR-07. Some are covered implicitly by step
   text (for example backups in Step 2, pen tests in Step 6) but not by ID, so they can be missed.
2. **Data classification (DC) has no requirement IDs**, unlike every other module, so it cannot
   be referenced the way CLAUDE.md asks. The draft [Step 2 spec](specs/step-02-secure-foundation.md) proposes DC-01.
3. ✅ _Resolved: the requirements now point to the guideline as the only plan._ **Two delivery plans disagree.** The requirements' "Delivery plan" has 8 phases (0 to 7) and a
   "Sprint 0" list; the guideline has 10 steps. Lengths and grouping differ (for example the
   requirements put IC, LB and MV in one phase; the guideline splits them into Steps 7 and 8).
   The requirements should point to the guideline instead of keeping their own plan.
4. ✅ _Resolved._ **"Sprint 0 foundation" list is mis-numbered** (`1, 1, 1, 2, …`) in the requirements.
5. ✅ _Resolved._ **Branch protection and signed commits** (guideline Step 1 item 1 and exit criterion) conflict
   with [ADR 0004](adr/0004-github-free-no-branch-protection.md). The guideline should note the
   accepted deviation.
6. **Backups to a second India region** (EN-10, guideline Step 2 item 3, SO-10 drill in Step 10)
   assume cross-region copies to Hyderabad. If the AWS project is limited to a single Region,
   this is not possible; confirm the project's allowed Regions before Step 2 and record the
   outcome in an ADR. Resolved by decision D1 in the [Step 2 spec](specs/step-02-secure-foundation.md); EN-10 reworded.
7. **AD-04 lists four catalogue types**, but guideline Step 4 says the catalogue covers all six
   services (adds dental and skin treatments, lab tests). AD-04 should match.
8. ✅ _Resolved._ **Product name:** the requirements say the application "has no name yet" and keep it as an
   open question; the repo and CLAUDE.md call it HEACH.
9. ✅ _Resolved._ **Repository row of the stack table** in the requirements lists three packages; the
   monorepo has six (`types`, `crypto`, `logger` missing).
10. **Open questions have no owner or due step.** Several block specific steps (load targets block
    TS-08 and Step 4 load tests; the Aadhaar route blocks Step 3; Hindi at launch affects I18N).
11. **Third-party applications** (payment gateway, SMS DLT, Aadhaar partner, video) must start in
    Step 1, but their status is not tracked anywhere in the repo.
12. ✅ _Resolved 18 October: module approved and added to D4._ **SO-08.2 asks for a Caddy rate limit, but stock Caddy has none.** It needs the third-party
   `caddy-ratelimit` module and a custom Caddy build, which is not in the Step 2 dependency list
   (D4). The API rate limit (SO-08.1) is on. Owner decision: add the module to D4, or reword SO-08.2.
