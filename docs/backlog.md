# Backlog

Ordered list of the next bounded pieces of work. Each becomes a feature spec
(`/speckit-specify`, [spec workflow](spec-workflow.md)) or step charter before any code
([constitution](../.specify/memory/constitution.md) I). This page orders work; it holds no
rules or criteria. Done items move to [implementation status](implementation-status.md).
Review IDs (S-1, C-2, …) refer to the 18 October 2026 codebase review
(`docs/reviews/2026-10-18-codebase-review.md`, not yet committed).

| # | Item | Links | Why this position |
| --- | --- | --- | --- |
| 0 | Session-refresh reliability (done, #56) | SE-07; review C-1, T-1; [spec](../specs/001-session-refresh-reliability/spec.md) | High: users signed out of every device |
| 1 | Rate-limit bypass with fake bearer tokens (implemented in #64, deployed 22 October; Done on owner review of the evidence) | SO-08, SE-08; review S-1, T-3; [spec](../specs/002-rate-limit-bypass/spec.md) | High: unlimited calls to public endpoints; must be fixed before OTP sign-in (Step 3) |
| 2 | Transactional domain writes and their audit entries (`withTransaction` helper; spec 003, merged #67, deployed 22 October; Done on owner review of the evidence) | SE-05; review S-2; [spec](../specs/003-transactional-audit-writes/spec.md) | Audit can miss a write; Step 3 repositories should reuse the helper |
| 3 | Transactional session rotation (revoke old + create new session in one transaction; keep the cookie on non-401 refresh errors; spec 004, merged #69, deployed 23 October; Done on owner review of the evidence) | SE-07; review S-2 note; [spec 004](../specs/004-transactional-session-rotation/spec.md) | A failure between the two statements signs the user out, and under a concurrent replay the winner's new session can outlive the revocation (found in the [session-refresh analysis](../specs/001-session-refresh-reliability/analysis.md)); same helper as item 2 |
| 4 | Bounded re-encryption worker (keyset cursor, `< current` version, row counts, per-row audit; spec 005, merged #70, deployed 23 October; Done on owner review of the evidence) | EN-05, SE-05; review C-2, T-3; [spec 005](../specs/005-bounded-reencryption/spec.md) | Can loop forever during a key rotation |
| 5 | Encrypted backups and restore proof (scheduled restore test, evidence; off-account recovery of Restricted fields without the AWS account; recurring check drafted as spec 006, PR #72, Draft awaiting owner approval, amended 24 October for the spec 007 roles; recovery, weekly copy and passphrase decisions proposed in ADR 0012) | EN-10, SO-10; Step 2 spec D1; [assessment](step-2-assessment-2026-10-22.md#backups-and-recovery) | Backups exist on dev; no recurring restore check; the off-account copy cannot decrypt Restricted fields if the account is lost (needs an owner decision and ADR before real data) |
| 6 | Step 2 operational acceptance evidence | [status](implementation-status.md): SNS subscription confirmed in AWS 24 October; inbox receipt of the synthetic alerts SNS reported delivered that day (owner), Odia review (I18N-07), lawyer review (D6) | Owner actions that close Step 2's exit |
| 7 | Step 3: accounts, consent, provider onboarding, identity verification, admin approval | AC-01 to AC-06, SE-08, PR-01, PR-04, KY-01 to KY-09, PO-01 to PO-07, AD-01 to AD-03, AD-11, AD-12; [guideline Step 3](mvp-v1-implementation-guideline.md#step-3-accounts-identity-verification-and-provider-onboarding) | Needs a Step 3 charter first, then one feature spec per slice |
| 8 | Shared rate-limit counters in Redis (custom `ThrottlerStorage` over the existing `ioredis`, no new dependency) | SO-08; review P-1; [spec 002 research D-1](../specs/002-rate-limit-bypass/research.md) | Needed before a second API process or host. Re-checked 24 October: `deploy/dev/compose.yml` runs one `api` service, `node dist/main.js` with no cluster, on one host (`aws_instance.host`), so in-memory counters are exact; not started |

## Decisions waiting for the owner

- **Refresh-token grace window** (accept the previous token briefly after rotation). Not adopted:
  it weakens replay detection (SE-07.2, SE-07.13). Only worth a reviewed decision if lost refresh
  responses prove common in practice. Raised by review C-1 as optional.
