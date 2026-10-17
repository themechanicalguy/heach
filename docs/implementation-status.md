# Implementation status

- **Last updated:** 17 October 2026, credit-expiry alerts, sleep and wake, tag check in CI (playbook B4)
- **Current step:** Step 1 of the [implementation guideline](mvp-v1-implementation-guideline.md)

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
| 9 | Auto-deploy to dev and staging; preview deploy per PR | 🟡 Partial | Deploy to dev on merge: OIDC, image scan gate, SSM deploy, smoke test, rollback to the previous tag. No staging, no previews (replaced by dev only, playbook) |
| 10 | README, contributing guide, ADR template, `docs/` | ✅ Done | |

### Step 1 exit criteria

| Criterion | Status |
| --- | --- |
| New developer runs all three apps locally within 30 minutes | ✅ Done |
| Merged PR reaches staging without manual steps | ⬜ Not started (reaches dev only) |
| `main` protected; pipeline blocks a failing build | 🟡 Partial (process, not enforced; see ADR 0004) |
| Third-party applications submitted and tracked | ⬜ Unknown: not recorded in the repo |

## Requirements by module

Every module not listed under "Partial" below is ⬜ Not started.

| Module | IDs | Done | Partial | Not started | Planned in step |
| --- | --- | --- | --- | --- | --- |
| DC Data classification | (no IDs) | | | all | 2 |
| EN Encryption | 13 | 0 | 7 | 6 | 2 |
| SE Access control and audit | 9 | 0 | 1 | 8 | 2, 3, 6 |
| PR Privacy and consent | 7 | 0 | 2 | 5 | 3 |
| SO Secure development and operations | 10 | 0 | 3 | 7 | 2, 6, 10 |
| PF Performance | 7 | 0 | 0 | 7 | 2 |
| A11Y Accessibility | 7 | 0 | 0 | 7 | not mapped (see gaps) |
| I18N Multi-language | 7 | 0 | 2 | 5 | 2 |
| TS Testing | 9 | 0 | 3 | 6 | 2 |
| LM Logging and monitoring | 9 | 0 | 1 | 8 | 2 |
| UX User experience | 8 | 0 | 1 | 7 | 2 |
| AC, PO, KY, AD-01 to 03, 11, 12 | 6 + 7 + 9 + 5 | 0 | 0 | all | 3 |
| SL, AV, SD, AD-04 | 9 + 4 + 5 + 1 | 0 | 0 | all | 4 |
| BK, PY, NT, AD-05, AD-07 | 9 + 7 + 3 + 2 | 0 | 0 | all | 5 |
| OC, HS, RF, AD-06 | 7 + 6 + 3 + 1 | 0 | 0 | all | 6 |
| IC, LB, AD-13 | 10 + 11 + 1 | 0 | 0 | all | 7 |
| MV, AD-15 | 16 + 1 | 0 | 0 | all | 8 |
| PK, RR, AD-08 to 10, 14, 16, 17 | 8 + 8 + 6 | 0 | 0 | all | 9 |

No functional requirement (journeys J1 to J9) is implemented yet.

### Partial requirements

| ID | What exists | What is missing |
| --- | --- | --- |
| EN-01 | TLS on 443 through Caddy's internal CA, HSTS header, port 80 redirects to HTTPS | Publicly trusted certificate; TLS to PostgreSQL and Redis (ADR 0008) |
| EN-02 | Encrypted EBS disk and snapshots, state bucket, uploads bucket (SSE-KMS), ECR images | Encrypted log store; queues and search do not exist yet |
| EN-04 | Customer managed KMS keys in Mumbai; host role may only generate and decrypt data keys | `@heach/crypto` envelope encryption not implemented (Step 2) |
| EN-06 | One key per data domain (health, identity, payments, documents) per environment, yearly rotation | Only dev exists; the app does not use the keys yet |
| EN-07 | Private, versioned uploads bucket, SSE-KMS (documents key), public access blocked, TLS only | Per-object keys, virus scanning, signed URLs (Step 2 onward) |
| EN-10 | Nightly EBS snapshots kept 7 days, encrypted | Separate backup keys, copy to Hyderabad, quarterly restore test (ADR 0008) |
| EN-12 | gitleaks in hooks and CI; generated passwords in SSM Parameter Store; CI deploys over OIDC without keys | Secrets manager with rotation |
| SE-04 | Admin has no public port; reached only through Session Manager port forwarding (IAM sign-in with MFA) | In-app MFA, short sessions, export controls (no admin login exists yet) |
| PR-06 | `naming` module rejects regions outside India; everything in `ap-south-1` | Data processing agreements with third parties |
| PR-07 | Logger redacts personal keys | No analytics or monitoring tools yet |
| SO-03 | Secret scan, `pnpm audit` (high blocks), ECR scan on push | Static analysis (SAST) and container scanning in CI |
| SO-06 | Access only through SSM Session Manager, no SSH | Bastion or zero-trust proxy for production, quarterly review |
| SO-07 | Synthetic-data rule in docs and CLAUDE.md | Enforcement once real data exists |
| I18N-01 | Locales `or`, `en`, `hi` defined; Odia default | Locale-prefixed routing, adding a language without code change |
| I18N-02 | ESLint warns on hard-coded JSX strings | ICU catalogues; rule becomes an error in Step 2 |
| TS-01 | Vitest in every package and app | 80% coverage threshold on changed code |
| TS-03 | API integration tests against real PostgreSQL and Redis in CI (`/healthz`, `/readyz`) | Every endpoint (none beyond health yet) |
| TS-05 | E2E smoke for web and admin on every PR (Chromium) | Nightly full suite; mobile and tablet projects |
| LM-02 | `@heach/logger` masks personal keys | Correlation IDs and the rest of LM in Step 2 |
| UX-01 | `@heach/ui` with a `Button` and tokens | Storybook, the remaining base components |

## Documentation gaps found in review

Found while building this page. Open items need a decision before the source docs change; under
[ADR 0007](adr/0007-spec-driven-development.md) each is settled in the spec of the step it
affects at the latest (for example item 6 in the Step 2 spec).

1. **37 requirement IDs are not assigned to any guideline step:** all of A11Y-01 to 07; EN-01, 02,
   07, 10, 13; SE-01, 03, 04; PR-02, 03, 05, 06, 07; SO-02, 04, 06, 07, 09, 10; TS-08, 09;
   LM-08, 09; UX-06, 07, 08; AC-05; BK-06; LB-09; RR-07. Some are covered implicitly by step
   text (for example backups in Step 2, pen tests in Step 6) but not by ID, so they can be missed.
2. **Data classification (DC) has no requirement IDs**, unlike every other module, so it cannot
   be referenced the way CLAUDE.md asks.
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
   outcome in an ADR.
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
