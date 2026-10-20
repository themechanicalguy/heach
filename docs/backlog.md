# Backlog

Ordered list of the next bounded pieces of work. Each becomes a feature spec
(`/speckit-specify`, [spec workflow](spec-workflow.md)) or step charter before any code
([constitution](../.specify/memory/constitution.md) I). This page orders work; it holds no
rules or criteria. Done items move to [implementation status](implementation-status.md).
Review IDs (S-1, C-2, …) refer to the 18 October 2026 codebase review
(`docs/reviews/2026-10-18-codebase-review.md`, not yet committed).

| # | Item | Links | Why this position |
| --- | --- | --- | --- |
| 0 | Session-refresh reliability (in progress) | SE-07; review C-1, T-1; [spec](../specs/001-session-refresh-reliability/spec.md) | High: users signed out of every device |
| 1 | Rate-limit bypass with fake bearer tokens | SO-08, SE-08; review S-1, T-3 | High: unlimited calls to public endpoints; must be fixed before OTP sign-in (Step 3) |
| 2 | Transactional domain writes and their audit entries (`withTransaction` helper) | SE-05; review S-2 | Audit can miss a write; Step 3 repositories should reuse the helper |
| 3 | Transactional session rotation (revoke old + create new session in one transaction; keep the cookie on non-401 refresh errors) | SE-07; review S-2 note | A failure between the two statements signs the user out, and under a concurrent replay the winner's new session can outlive the revocation (found in the [session-refresh analysis](../specs/001-session-refresh-reliability/analysis.md)); same helper as item 2 |
| 4 | Bounded re-encryption worker (keyset cursor, `< current` version, row counts) | EN-05; review C-2, T-3 | Can loop forever during a key rotation |
| 5 | Encrypted backups and restore proof (scheduled restore test, evidence) | EN-10, SO-10; Step 2 spec D1 | Backups exist on dev; quarterly restore proof not yet scheduled |
| 6 | Step 2 operational acceptance evidence | [status](implementation-status.md): credit alert email receipt and scheduled runs, Odia review (I18N-07), lawyer review (D6) | Owner actions that close Step 2's exit |
| 7 | Step 3: accounts, consent, provider onboarding, identity verification, admin approval | AC-01 to AC-06, SE-08, PR-01, PR-04, KY-01 to KY-09, PO-01 to PO-07, AD-01 to AD-03, AD-11, AD-12; [guideline Step 3](mvp-v1-implementation-guideline.md#step-3-accounts-identity-verification-and-provider-onboarding) | Needs a Step 3 charter first, then one feature spec per slice |

## Decisions waiting for the owner

- **Refresh-token grace window** (accept the previous token briefly after rotation). Not adopted:
  it weakens replay detection (SE-07.2, SE-07.13). Only worth a reviewed decision if lost refresh
  responses prove common in practice. Raised by review C-1 as optional.
