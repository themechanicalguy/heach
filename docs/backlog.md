# Backlog

Ordered list of the next bounded pieces of work. This page orders work; it holds no rules. Done items move to [implementation status](implementation-status.md).
Review IDs (S-1, C-2, …) refer to the 18 October 2026 codebase review
(`docs/reviews/2026-10-18-codebase-review.md`, not yet committed).

Items 0 to 4 are done: specs [001](archive/specs/001-session-refresh-reliability/spec.md) to
[005](archive/specs/005-bounded-reencryption/spec.md), accepted by the owner on 25 October 2026. Their
numbers stay because those specs cite them.

| # | Item | Links | Why this position |
| --- | --- | --- | --- |
| 5 | Encrypted backups and restore proof (scheduled restore test, evidence; off-account recovery of Restricted fields without the AWS account; recurring check spec 006 approved 25 October and implemented (awaiting merge, deploy and four weekly runs); ADR 0012 accepted 25 October: R1 accept for dev, R2 manual pull with a weekly reminder, R3 password-manager copy with a test decryption) | EN-10, SO-10; Step 2 spec D1; [assessment](https://github.com/themechanicalguy/heach/blob/338943c/docs/step-2-assessment-2026-10-22.md#backups-and-recovery) | Backups exist on dev; no recurring restore check until spec 006 runs; R3 test decryption is an owner action |
| 6 | Step 2 operational acceptance evidence | [status](implementation-status.md): SNS subscription confirmed in AWS 24 October; both synthetic alerts received in the owner's inbox (confirmed 25 October); Odia review (I18N-07), lawyer review (D6); since the [audit](step-1-2-audit.md) of 25 October also LM-02.1 nested masking (needs a spec) and the real-phone demo. Dates and closure conditions: [follow-up register](follow-up-register.md#closes-step-2) | Close Step 2's exit; LM-02.1 before Step 3 logs personal data |
| 6a | Offline escrow wrap of data keys (ADR 0012 R1 option B): RSA-OAEP public-key wrap per data key, offline private key, SO-10 recovery drill | EN-10, EN-04, SO-10; [ADR 0012](adr/0012-off-account-recovery-of-restricted-fields.md) | Pilot gate (ADR 0009), not Step 2: needed before the first real record |
| 7 | Step 3: accounts, consent, provider onboarding, identity verification, admin approval | AC-01 to AC-06, SE-08, PR-01, PR-04, KY-01 to KY-09, PO-01 to PO-07, AD-01 to AD-03, AD-11, AD-12; [guideline Step 3](mvp-v1-implementation-guideline.md#step-3-accounts-identity-verification-and-provider-onboarding) | Needs a Step 3 charter first, then one feature spec per slice |
| 8 | Shared rate-limit counters in Redis (custom `ThrottlerStorage` over the existing `ioredis`, no new dependency) | SO-08; review P-1; [spec 002 research D-1](archive/specs/002-rate-limit-bypass/research.md) | Needed before a second API process or host. Re-checked 24 October: `deploy/dev/compose.yml` runs one `api` service, `node dist/main.js` with no cluster, on one host (`aws_instance.host`), so in-memory counters are exact; not started |

## Decisions waiting for the owner

- **Refresh-token grace window** (accept the previous token briefly after rotation). Not adopted:
  it weakens replay detection (SE-07.2, SE-07.13). Only worth a reviewed decision if lost refresh
  responses prove common in practice. Raised by review C-1 as optional.
