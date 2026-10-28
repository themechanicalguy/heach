# Step 2 acceptance matrix

Criterion-by-criterion check of [Step 2](archive/step-specs/step-02-secure-foundation.md) against code, tests,
deployment and dated manual evidence, together with the corrective feature specs, the step's
decisions, ADRs 0010 to 0012 and the [guideline exit criteria](mvp-v1-implementation-guideline.md#step-2-secure-foundation-and-quality-gates).
Detailed evidence lives in the [Step 2 log](step-2-progress.md); this page states what is met and
what is not. Regenerate the criteria table when the log changes.

- **Checked:** 25 October 2026, on `main` `952f350`, re-verified on the host at 07:31 UTC (see the deploy record below)
- **Audited:** 25 October 2026, 08:47 to 09:20 UTC, on `main` `338943c`, independently, in the
  [Step 1 and Step 2 audit](step-1-2-audit.md). It changed LM-02.1 from Met to Partial and added
  open items 4 and 5. Due dates, procedures and closure conditions for every open item are in the
  [follow-up register](follow-up-register.md#closes-step-2), not repeated here.
- **Verdict:** **Step 2 is not complete.** 73 of the 74 acceptance criteria of the step spec have
  passing tests or dated evidence; LM-02.1 was Partial until the nested-masking fix of 28 October
  2026 (open item 4, closed). These remain:

| # | Open item | Kind | Exact dependency |
| --- | --- | --- | --- |
| 1 | Lawyer's first review of consent wording and the Aadhaar route (guideline exit criterion, D6) | External review | The owner sends [the pack](reviews/lawyer-review-step-2.md) to a lawyer of their choice and shares the feedback; the owner is arranging it (25 October 2026) |
| 2 | Native Odia review of the Step 2 keys (I18N-07, step spec "Screens and languages") | External review | The owner arranges a native speaker with medical vocabulary ([sheet](reviews/odia-review-step-2.md)); feedback then goes into the catalogues and is retested |
| 3 | Spec 006 SC-001: four consecutive weekly restore-check records on the dev host | Observation period | Scheduled runs on Sundays 1, 8, 15 and 22 November 2026 (00:00 UTC); a newly enabled timer has no missed run to catch up, so 1 November is the first |
| 4 | LM-02.1 for nested input: the shared logger writes a mobile number nested two levels down, or inside a nested string, in clear (found by the audit with synthetic values, 25 October 2026; review S-6) | Engineering | Closed: fixed 28 October 2026 on branch `feat/nested-log-masking`: one recursive pass in `@heach/logger` redacts personal keys and masks mobile numbers at every depth, in errors, interpolation, child bindings and context, with placeholders past depth 8, for cycles, binary and unreadable values (LM-02.3 to LM-02.8 tests, design in [archived spec 008](archive/specs/008-nested-log-masking/spec.md)); the audit probe now writes 0 numbers in clear (2 before) ([FU-27](follow-up-register.md#closes-step-2)) |
| 5 | Step-end demo on a real mid-range Android phone, in Odia, over a throttled network (guideline rule for every step; not tracked before the audit) | Owner demonstration | A dated record in the [log](step-2-progress.md), or a written waiver ([FU-08](follow-up-register.md#closes-step-2)) |

## Status by kind

| Kind | Items | State on 25 October 2026 |
| --- | --- | --- |
| Engineering implemented and verified | 73 of the 74 step spec criteria; the four engineering exit criteria; specs 001 to 007 built, merged, deployed and tested; spec 006 timer deployed, enabled and run by hand; failure alert path proven | Done |
| Engineering open | None: LM-02.1 nested masking (open item 4) fixed 28 October 2026 | Done |
| Human reviews pending | Lawyer review (open item 1); native Odia review (open item 2); real-phone demo (open item 5) | Owner arranges all three. Packs are ready, and nobody has been contacted by Claude Code |
| Scheduled observation pending | Spec 006 SC-001, four scheduled runs (open item 3), then G4 for spec 006 | Runs on 1, 8, 15 and 22 November 2026, independent of any session. Each is recorded after it happens. The manual runs of 25 October do not count |

## Closing Step 2

Step 2 closes when all five open items are closed, in any order (rows FU-01 to FU-08 and FU-27 of
the [follow-up register](follow-up-register.md#closes-step-2)):

1. **Lawyer review.** The owner shares the lawyer's feedback. Wording changes go through a spec or
   requirements PR first, then code. Record the date and outcome in the
   [review pack](reviews/lawyer-review-step-2.md), here (exit criterion row and open item 1) and in
   D6.
2. **Odia review.** Apply the feedback as the [sheet](reviews/odia-review-step-2.md#applying-it-developer)
   describes. Close open item 2 and mark I18N-07 Done on the status page if no gap remains.
3. **SC-001.** After each Sunday run, add its row to the
   [records table](runbooks/backup-restore.md#weekly-restore-check-records-sc-001)
   ([how](runbooks/backup-restore.md#scheduled-runs-where-the-evidence-is-and-how-to-read-it)).
   After the fourth consecutive row (22 November if none is missed), record the owner's G4
   acceptance of spec 006 in its tasks file, the specs index and here, and EN-10's status.
4. **LM-02.1.** Done 28 October 2026: fix merged with green CI, LM-02.1 Met here, LM-02 Done on the
   status page.
5. **Real-phone demo.** Record it in the log, or record the owner's written waiver.

Then set the verdict above to complete. Mark guideline Step 2 Done in
[implementation status](implementation-status.md) and the log, and move the current step to Step 3
(the "Current:" marker in `CLAUDE.md`).

## Guideline exit criteria

| Exit criterion | Evidence | State |
| --- | --- | --- |
| A sample note travels end to end: entered in Odia on a phone, field-encrypted, readable only by its owner, with an audit entry | EN-13.1, EN-03.1, SE-02.3, I18N-04.1, SE-05.1 below; deploy-bundle E2E on mobile, tablet and desktop behind Caddy | Met (Chromium device emulation; the real-phone demo is open item 5) |
| A test proves the note is ciphertext in the database and absent from logs | `test/sample-notes.int-spec.ts`; deploy-bundle SQL and log checks | Met |
| A pull request with a hard-coded string, missing translation, accessibility violation, oversized bundle or leaked secret is blocked | I18N-02.1, I18N-07.1, UX-01.2 and TS-02.1, PF-02.1, EN-12.3 fixtures | Met |
| Traces show one correlation ID from browser to database | LM-01.1 (`e2e/notes-flow.spec.ts`, `test/tracing.int-spec.ts`; local Jaeger, ADR 0010) | Met |
| The lawyer's first review of consent wording and the Aadhaar route is in hand | [Review pack](reviews/lawyer-review-step-2.md) prepared; not yet reviewed | **Not met** (open item 1) |

## Step 2 spec acceptance criteria

74 criteria. Kind: automated tests run in CI on every pull request; manual checks have a dated record in the [log](step-2-progress.md).

| Area | ID | Proof the spec asks for | Evidence | Kind | State |
| --- | --- | --- | --- | --- | --- |
| Encryption | EN-01.1 | Integration test | `test/data-tls.int-spec.ts` | Automated (CI) | Met |
| Encryption | EN-01.2 | Integration test | `test/security.int-spec.ts` | Automated (CI) | Met |
| Encryption | EN-01.3 | Manual: `openssl s_client` output in the PR | dated 2026-10-18 | Manual, dated | Met |
| Encryption | EN-02.1 | `scripts/check-tags.mjs` style check in CI | `scripts/check-infra-security.mjs` | Automated (CI) | Met |
| Encryption | EN-03.1 | Integration test | `test/sample-notes.int-spec.ts` | Automated (CI) | Met |
| Encryption | EN-03.2 | Unit test | `packages/crypto/src/*.test.ts`; `kms-key-provider.spec.ts`; `envelope.test.ts` | Automated (CI) | Met |
| Encryption | EN-04.1 | Unit test with a KMS test double | `packages/crypto/src/*.test.ts`; `kms-key-provider.spec.ts` | Automated (CI) | Met |
| Encryption | EN-04.2 | Terraform policy review plus `tofu plan` | `scripts/check-infra-security.mjs`; dated 2026-10-18 | Automated (CI) | Met |
| Encryption | EN-05.1 | Unit test | `packages/crypto/src/*.test.ts`; `kms-key-provider.spec.ts` | Automated (CI) | Met |
| Encryption | EN-05.2 | Terraform check | `scripts/check-infra-security.mjs` in CI (every `aws_kms_key` rotates yearly) | Automated (CI) | Met |
| Encryption | EN-05.3 | Integration test plus runbook in `docs/` | `test/crypto.int-spec.ts` | Automated (CI) | Met |
| Encryption | EN-06.1 | Unit test | `packages/crypto/src/*.test.ts`; `kms-key-provider.spec.ts` | Automated (CI) | Met |
| Encryption | EN-09.1 | Unit and integration test | `packages/crypto/src/*.test.ts`; `kms-key-provider.spec.ts` | Automated (CI) | Met |
| Encryption | EN-09.2 | Integration test | `test/crypto.int-spec.ts` | Automated (CI) | Met |
| Encryption | EN-13.1 | Integration test | `test/sample-notes.int-spec.ts`; `e2e/notes-flow.spec.ts` | Automated (CI) | Met |
| Data classification | DC-01.1 | CI check with a failing fixture | `classification.int-spec.ts` | Automated (CI) | Met |
| Data classification | DC-01.2 | CI check | `classification.int-spec.ts` | Automated (CI) | Met |
| Database and backups | EN-10.1 | CI job | `db-roles.int-spec.ts` | Automated (CI) | Met |
| Database and backups | EN-10.2 | Integration test | `db-roles.int-spec.ts` | Automated (CI) | Met |
| Database and backups | EN-10.3 | Manual: object listing in the PR | `scripts/backup-pull.sh`; dated 2026-10-18, 2026-10-24, 24 October 2026 | Manual, dated | Met |
| Database and backups | EN-10.4 | Manual restore record in `docs/` | Restore records dated 18 and 24 October 2026 (`docs/runbooks/backup-restore.md`); recurring check: spec 006 | Manual, dated | Met |
| Secrets | EN-12.1 | Container scan plus review | `load-secrets.spec.ts`; dated 2026-10-18 | Automated (CI) | Met |
| Secrets | EN-12.2 | Manual record in `docs/` | `deploy.sh`; `scripts/deploy-script.test.mjs`; dated 2026-10-18 | Manual, dated | Met |
| Secrets | EN-12.3 | Existing gitleaks job plus a fixture test | pre-commit and CI gitleaks; `scripts/security/scanner-fixtures.sh` (planted token blocked) | Automated (CI) | Met |
| Authorisation and sessions | SE-02.1 | Unit test over the route table | `src/auth/route-roles.spec.ts` | Automated (CI) | Met |
| Authorisation and sessions | SE-02.2 | Integration test (TS-09) | `test/authz-matrix.int-spec.ts` | Automated (CI) | Met |
| Authorisation and sessions | SE-02.3 | Integration test | `notes.repository.spec.ts`; `sample-notes.int-spec.ts` | Automated (CI) | Met |
| Authorisation and sessions | SE-07.1 | Integration test | `test/auth.int-spec.ts` | Automated (CI) | Met |
| Authorisation and sessions | SE-07.2 | Integration test | `test/auth.int-spec.ts` | Automated (CI) | Met |
| Authorisation and sessions | SE-07.3 | Integration test | `test/auth.int-spec.ts` | Automated (CI) | Met |
| Authorisation and sessions | SE-07.4 | Unit test | `test-identity.adapter.spec.ts` | Automated (CI) | Met |
| Authorisation and sessions | SE-09.1 | Integration test | `sample-notes.int-spec.ts` | Automated (CI) | Met |
| Audit log | SE-05.1 | Unit test | `notes.repository.spec.ts`; `sample-notes.int-spec.ts` | Automated (CI) | Met |
| Audit log | SE-05.2 | Unit test | `audit-chain.int-spec.ts`; `notes.repository.spec.ts`; `sample-notes.int-spec.ts` | Automated (CI) | Met |
| Audit log | SE-05.3 | Integration test | `audit-chain.int-spec.ts` | Automated (CI) | Met |
| Audit log | SE-05.4 | Integration test | `db-roles.int-spec.ts` | Automated (CI) | Met |
| Security middleware and scanning | SO-01.1 | `docs/specs/0000-template.md` plus this spec | `docs/specs/0000-template.md`; `scripts/check-specs.mjs`; `check-specs.test.mjs` | Automated (CI) | Met |
| Security middleware and scanning | SO-03.1 | CI with a failing fixture per scanner | `security/semgrep/heach.yml`; `scripts/security/scanner-fixtures.sh` | Automated (CI) | Met |
| Security middleware and scanning | SO-05.1 | Integration test | `test/security.int-spec.ts`; `apps/web/e2e/home.spec.ts`; `src/security/csp.test.ts`; `proxy.ts` | Automated (CI) | Met |
| Security middleware and scanning | SO-05.2 | Integration test | `sample-notes.int-spec.ts` | Automated (CI) | Met |
| Security middleware and scanning | SO-08.1 | Integration test | `test/security.int-spec.ts` | Automated (CI) | Met |
| Security middleware and scanning | SO-08.2 | Integration test | `security.int-spec.ts` | Automated (CI) | Met |
| Security middleware and scanning | SO-08.3 | Integration test against the alert rule | `test/security.int-spec.ts`; live 24 October 2026: published 1, delivered 1; received, owner confirmed 25 October 2026 | Automated (CI) | Met |
| Logging and monitoring | LM-01.1 | E2E test reading the trace | `apps/web/e2e/notes-flow.spec.ts`; `test/tracing.int-spec.ts` | Automated (CI) | Met |
| Logging and monitoring | LM-02.1 | Unit test in `@heach/logger` | `packages/logger/src/index.test.ts`, `sanitize.test.ts` (LM-02.3 to LM-02.8, every depth); audit probe re-run 28 October 2026: 0 numbers in clear | Automated (CI) | Met |
| Logging and monitoring | LM-02.2 | Lint fixture | `apps/api/src/lint-rules.spec.ts` | Automated (CI) | Met |
| Logging and monitoring | LM-03.1 | Manual record | `e2e/error-tracking.spec.ts` against local GlitchTip; dated 18 October 2026 (ADR 0010: local only) | Manual, dated | Met |
| Logging and monitoring | LM-04.1 | Manual record | dated 2026-10-18 | Manual, dated | Met |
| Logging and monitoring | LM-05.1 | Manual record | Local Grafana record dated 18 October 2026; `scripts/observability-dashboard.test.mjs` (ADR 0010: local only) | Manual, dated | Met |
| Logging and monitoring | LM-07.1 | Manual: test alert record | `error-rate.monitor.spec.ts`; live 24 October 2026: published 1, delivered 1; received, owner confirmed 25 October 2026 | Manual, dated | Met |
| Internationalisation | I18N-01.1 | E2E test | `apps/web/e2e/home.spec.ts`; `packages/i18n/README.md` | Automated (CI) | Met |
| Internationalisation | I18N-02.1 | Lint fixture | `apps/web/src/lint-rules.test.ts` | Automated (CI) | Met |
| Internationalisation | I18N-02.2 | Unit test | `packages/i18n/src/icu.test.ts`; `translator.test.ts` | Automated (CI) | Met |
| Internationalisation | I18N-03.1 | Unit test | `packages/i18n/src/format.test.ts` | Automated (CI) | Met |
| Internationalisation | I18N-04.1 | Integration test | `test/sample-notes.int-spec.ts` | Automated (CI) | Met |
| Internationalisation | I18N-06.1 | Visual snapshot | `e2e/shell.spec.ts` | Automated (CI) | Met |
| Internationalisation | I18N-07.1 | Existing check plus fixture | `packages/i18n/src/catalogues.test.ts` | Automated (CI) | Met |
| Design system | UX-01.1 | Storybook build in CI | Storybook build step in CI (`.github/workflows/ci.yml`); stories for every component | Automated (CI) | Met |
| Design system | UX-01.2 | Component tests | `packages/ui/src/stories.test.tsx` | Automated (CI) | Met |
| Design system | UX-02.1 | Unit test of tokens | `packages/ui/src/tokens.test.ts` | Automated (CI) | Met |
| Design system | UX-03.1 | Visual snapshot | `e2e/shell.spec.ts` | Automated (CI) | Met |
| Design system | UX-04.1 | Stories | `States.tsx`; `States.test.tsx` | Automated (CI) | Met |
| Design system | UX-05.1 | Component test | `OtpField.test.tsx` | Automated (CI) | Met |
| Testing and performance gates | TS-01.1 | CI fixture | `scripts/check-changed-coverage.mjs` | Automated (CI) | Met |
| Testing and performance gates | TS-02.1 | CI | `coverage-of-components.test.ts` | Automated (CI) | Met |
| Testing and performance gates | TS-03.1 | CI job | `.github/workflows/ci.yml`; `test/rum.int-spec.ts`; dated 24 October 2026, 25 October 2026 | Automated (CI) | Met |
| Testing and performance gates | TS-05.1 | CI job | `playwright.config.ts` | Automated (CI) | Met |
| Testing and performance gates | TS-06.1 | Unit tests plus lint boundary rule | `apps/api/src/adapters/*.port.ts`; `fakes.ts`; `lint-rules.spec.ts` | Automated (CI) | Met |
| Testing and performance gates | TS-07.1 | CI | `e2e/shell.spec.ts` | Automated (CI) | Met |
| Testing and performance gates | PF-02.1 | Bundle budget fixture | `e2e/bundle-budget.spec.ts`; `src/bundle-budget.test.ts` | Automated (CI) | Met |
| Testing and performance gates | PF-03.1 | Lighthouse CI | Lighthouse CI step in `.github/workflows/ci.yml` (asserts at least 90); local record 18 October | Automated (CI) | Met |
| Testing and performance gates | PF-05.1 | Build check | `e2e/bundle-budget.spec.ts`; `src/next-config.test.ts` | Automated (CI) | Met |
| Testing and performance gates | PF-07.1 | E2E test (also EN-11) | `e2e/pwa.spec.ts` | Automated (CI) | Met |
| Feature flags | FF-01.1 | Unit test | `feature-flags.spec.ts`; `sample-notes.int-spec.ts` | Automated (CI) | Met |

## Corrective feature specs

Each spec's tasks file holds its evidence. Gate G4 (Done) is the owner's review of that evidence: the owner accepted specs 001 to 005 and 007 on 25 October 2026; spec 006 waits for its four weekly runs.

| Spec | Criteria | Code | Tests (CI) | Deployed to dev | Live or manual evidence | G4 owner acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| [001 Session-refresh reliability](archive/specs/001-session-refresh-reliability/tasks.md) | SE-07.5 to SE-07.13 | #56 | Unit, integration and session E2E on three viewports; SC-001 50 of 50 | Yes (every deploy since 21 October) | Not host-specific (client behaviour) | Accepted 25 October 2026 |
| [002 Rate-limit bypass](archive/specs/002-rate-limit-bypass/tasks.md) | SO-08.4 to SO-08.11 | #64 | `rate-limit.int-spec.ts` and unit tests | Yes, `7c8c1c9`, smoke passed (22 October) | No separate host check; behaviour proven by CI integration tests (extended by spec 007's address limit) | Accepted 25 October 2026 |
| [003 Transactional audit writes](archive/specs/003-transactional-audit-writes/tasks.md) | SE-05.5 to SE-05.10 | #67 | `audit-transaction.int-spec.ts`, `transaction.spec.ts`; converge pass 25 October: no findings | Yes, `1d74b17` (22 October) | Not host-specific | Accepted 25 October 2026 |
| [004 Transactional session rotation](archive/specs/004-transactional-session-rotation/tasks.md) | SE-07.14 to SE-07.20 | #69 | `session-rotation.int-spec.ts`, unit tests, session E2E | Yes, `468c7f1` (23 October) | Not host-specific | Accepted 25 October 2026 |
| [005 Bounded re-encryption](archive/specs/005-bounded-reencryption/tasks.md) | EN-05.4 to EN-05.9 | #70 | `reencrypt.int-spec.ts`, `reencrypt.spec.ts` | Yes, `491f5a0` (23 October) | Run on the dev host 24 October without `--rotate`: exit 0 ([record](runbooks/key-rotation.md#record)) | Accepted 25 October 2026 |
| [006 Recurring restore check](archive/specs/006-recurring-restore-check/tasks.md) | EN-10.5 to EN-10.10 | #80 | `restore-check.int-spec.ts` (16), unit (9), scripts (11) | See the deploy record below | First run by hand (T017) below; SC-001 four weekly runs pending | Not yet (SC-001 open) |
| [007 Security review fixes](archive/specs/007-security-review-fixes/tasks.md) | SO-08.12, SE-07.21 to SE-07.23, EN-12.4, SO-03.2 | #74 | Integration and unit tests; deploy-bundle test sign-in checks | Yes, `8b0387f` after the owner's infra apply (24 October) | Live 24 October: API role reads exactly its 4 parameters, admin and migrator passwords denied, hop limit 1, public test sign-in 404, loopback 200 ([record](reviews/2026-10-24-security-review.md#live-verification-after-the-apply-2026-10-24)); re-checked after the spec 006 deploy below | Accepted 25 October 2026 |

## Decisions and ADRs

| Item | Decision | State |
| --- | --- | --- |
| D1 | Backups in ap-south-1 with their own key plus a weekly encrypted copy outside AWS | Built: nightly SSE-KMS dumps, off-account copy (18 and 24 October); recovery details in ADR 0012 |
| D2 | Parameter Store SecureString with a rotation procedure | Built: EN-12.1, EN-12.2 (rotation recorded 18 October); revisit at the pilot |
| D3 | WAF at the pilot; rate limits and validation now | Rate limits SO-08.1, SO-08.2, specs 002 and 007; WAF deferred by decision |
| D4 | Free, open-source, self-hosted dependencies only | Applied; `@sentry/cli` rejected for its FSL licence and replaced by an in-repo script |
| D5 | Alerts to the `heach-credit-reminders` topic | Subscription confirmed in AWS 24 October; two synthetic alerts received by the owner (confirmed 25 October) |
| D6 | Lawyer review is a Step 2 exit criterion, owner action | **Open** (open item 1) |
| [ADR 0010](adr/0010-step-2-backups-secrets-waf.md) | Backups, secrets, WAF deferral; observability local only | Accepted and applied (LM-03.1, LM-05.1 local records) |
| [ADR 0011](adr/0011-spec-kit-feature-specs.md) | Spec Kit feature specs | Accepted; specs 001 to 007 follow it |
| [ADR 0012](adr/0012-off-account-recovery-of-restricted-fields.md) | Off-account recovery: R1 accept for dev, R2 manual pull with reminder, R3 password-manager passphrase test | Accepted 25 October 2026; R2 reminder added and R3 passed (owner, 25 October 2026); R1 option B is a pilot-gate item (backlog 6a) |

## Human acceptance records

| What | Who | When | Record |
| --- | --- | --- | --- |
| Step 2 spec approved | Owner | 18 October 2026 | [Spec](archive/step-specs/step-02-secure-foundation.md) status |
| Specs 001 to 007 approved before code | Owner | 21 to 25 October 2026 | Each spec's Approval line |
| Spec 006 amendment (audit entry fields, live connection, throwaway grants, stage `job`) | Owner | 25 October 2026 | Spec 006 Approval line |
| Synthetic alerts LM-07.1 and SO-08.3 received in the intended inbox | Owner | 25 October 2026 | [Log](step-2-progress.md) rows SO-08.3 and LM-07.1 |
| ADR 0012 accepted | Owner | 25 October 2026 | ADR status |
| ADR 0012 R2 weekly reminder added; R3 passphrase recovered from the password manager (`PGDMP`) | Owner | 25 October 2026 | [Runbook](runbooks/backup-restore.md#weekly-off-account-copy-owner) |
| Spec 006 synthetic failure alert received in the intended inbox | Owner | 25 October 2026 | [Runbook](runbooks/backup-restore.md#weekly-restore-check-records-sc-001) |
| Lawyer review | Lawyer chosen by the owner | Not yet | Open item 1 |
| Native Odia review | Native speaker chosen by the owner | Not yet | Open item 2 |
| G4 acceptance of specs 001 to 005 and 007 | Owner | 25 October 2026 | This page; [specs index](archive/step-specs/README.md) |
| G4 acceptance of spec 006 | Owner | After SC-001 | Open item 3 |

## Requirement counts and later steps

The [status page](implementation-status.md#requirements-by-module) counts each requirement as a
whole, so most Step 2 requirements stay Partial after Step 2: their remaining gap belongs to a later
step, not to missing Step 2 work. Every in-scope Partial requirement, classified on 25 October 2026:

| Requirement | Remaining gap | Belongs to |
| --- | --- | --- |
| EN-01 | Publicly trusted certificate | Pilot (a domain) |
| EN-02 | Encrypted log store, queues, search | Steps 4, 5 and pilot |
| EN-04, EN-06 | Staging and production keys | Environments after dev (ADR 0009) |
| EN-05 | A data-key rotation schedule; a dev rotation is optional (owner's call) | Pilot operations |
| EN-10 | Four weekly restore-check records; escrow wrap | **Step 2** (open item 3); escrow at the pilot gate |
| EN-11 | Offline booking summaries, the vault | Steps 5 and 8 |
| EN-12 | Secrets Manager reconsidered | Pilot (D2) |
| SE-05, LM-09 | Audit retention (PR-05); admin actions | Step 3 onwards |
| SE-07 | OTP re-verification; documented residual risks | Step 3 |
| SE-09 | SMS, push and WhatsApp rules | Step 5 |
| SO-03 | Dynamic scan and penetration test (SO-04) | Before the pilot |
| SO-08 | Shared counters for a second process; SE-08 throttling; WAF | Step 3 and pilot (D3) |
| PF-01 | Field 75th percentile on a mid-range phone | Pilot (real users) |
| PF-07 | Offline bookings and queued actions | Step 5 |
| I18N-07 | Native Odia review | **Step 2** (open item 2) |
| TS-05 | Nightly and pre-release full suite (the journey suite, TS-04, does not exist yet) | Later steps |
| TS-06 | Real adapters and sandbox runs | Steps 3 and 5 |
| TS-09 | Vault sharing and entitlement tests | Steps 8 and 9 |
| LM-01 | Queue workers | Step 5 |
| LM-02 | Masking of nested values (found by the audit, 25 October 2026) | Done in Step 2, 28 October 2026 |
| LM-03, LM-05 | Error tracking and dashboards on a host | Pilot (ADR 0010) |
| LM-04 | Network type | Later (not in LM-04.1) |
| LM-07 | Payment, OTP, video and queue alerts | Steps 3, 5 and 6 |

## Deploy and live verification of the final version

25 October 2026, `main` at `a2cbf6f` (#80), after #81 (`3468179`):

| Check | Result |
| --- | --- |
| CI on `main` | Green for `3468179` and `a2cbf6f` (all jobs) |
| Deploy dev | [Run 40157998902](https://github.com/themechanicalguy/heach/actions/runs/40157998902) green; host `DEPLOYED_TAG` `a2cbf6f843db`; `scripts/smoke-test.sh` passed |
| Restore check timer | Enabled; next run Sunday 1 November 2026, 00:00 UTC; backup timer unchanged (21:00 UTC nightly) |
| Restore check by hand (T017) | Passed in 6 seconds; copy dropped; live audit entry `backup.restore_check` by `job:restore-check` with the dump name only |
| Restore check failure alert from the host | Published with the API role's credentials; SNS delivered 1, failed 0; received by the owner |
| Public test sign-in (SE-07.23) | 404 from the internet and through the public site on the host, also with a guessed `x-test-login-key`; the loopback entry `127.0.0.1:9443` issues a token |
| API role (EN-12.4) | `iam simulate-principal-policy`: `ssm:GetParameters` allowed on exactly `DB_APP_PASSWORD`, `REDIS_PASSWORD`, `BLIND_INDEX_KEY`, `TEST_LOGIN_KEY`; implicit deny on `POSTGRES_PASSWORD` and `DB_MIGRATOR_PASSWORD`; `sns:Publish` allowed |
| Host role | `sns:Publish` implicit deny (spec 007); reads its deploy parameters |
| Credential isolation | Instance metadata requires tokens with hop limit 1; from the API container the metadata endpoint times out |

Re-checked 25 October 2026, 07:31 UTC, after #82 deployed `952f350`. All checks were read-only;
no restore run was started.

| Check | Result |
| --- | --- |
| CI and Deploy dev on `main` | Green for `952f350` ([Deploy dev run 40161949029](https://github.com/themechanicalguy/heach/actions/runs/40161949029)); host `DEPLOYED_TAG` `952f35067ca1`; `scripts/smoke-test.sh` passed |
| Restore check timer | `enabled`, `active`, `Persistent=yes`, `OnCalendar=Sun *-*-* 00:00:00 UTC`; host timezone UTC; `systemd-analyze calendar` gives 1, 8, 15 and 22 November 2026, 00:00 UTC; `LastTriggerUSec` empty (it has never fired) |
| Deployed files | `restore-check.sh`, the timer and the service on the host have the same SHA-256 as `deploy/dev/` on `main` |
| Cleanup | No `heach_restorecheck_*` database exists |
| Audit | One `backup.restore_check` entry (role `system`, 03:45:03 UTC, T017); `audit.verify_chain()` reports no broken link; 35 entries |
| Evidence retention | Host journal 63.6 MB, reaching back to 17 October 2026, under the default size cap |
| Backup timer | Last run Saturday 24 October 21:00 UTC; next 25 October 21:00 UTC |
