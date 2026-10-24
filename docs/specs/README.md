# Specs index

Every spec in the repository, step level and feature level
([ADR 0007](../adr/0007-spec-driven-development.md), amended by
[ADR 0011](../adr/0011-spec-kit-feature-specs.md)). This page lists them; it does not hold
rules. How to write one: [spec workflow](../spec-workflow.md). Principles and gates:
[constitution](../../.specify/memory/constitution.md). CI fails if a spec is missing here.

- **Step specs** (`docs/specs/step-NN-*.md`, from [the template](0000-template.md)): one per
  guideline step; the step's charter, and for Step 2 all of its criteria.
- **Feature specs** (`specs/NNN-short-name/`, from `/speckit-specify`): one bounded slice of a
  step; `spec.md` behaviour, `plan.md` design, `tasks.md` work.

## Step specs

| Spec | Step | Status |
| --- | --- | --- |
| [Secure foundation and quality gates](step-02-secure-foundation.md) | 2 | Approved; baseline for later specs. Exit pending owner actions ([status](../implementation-status.md#step-2-secure-foundation-and-quality-gates)) |

Step 1 was built before ADR 0007; its record is in [implementation status](../implementation-status.md).

## Feature specs

| Feature | Step | Requirement IDs | Status |
| --- | --- | --- | --- |
| [Session-refresh reliability](../../specs/001-session-refresh-reliability/spec.md) | 2 | SE-07 | Done (#56) |
| [Rate-limit bypass](../../specs/002-rate-limit-bypass/spec.md) | 2 | SO-08, SE-08 | Approved; merged in #64, CI green, deployed to dev 22 October (smoke test passed); Done on owner review of the evidence |
| [Transactional audit writes](../../specs/003-transactional-audit-writes/spec.md) | 2 | SE-05 | Approved; merged in #67, CI green, deployed to dev 23 October (`491f5a0`, smoke test passed); Done on owner review of the evidence |
| [Transactional session rotation](../../specs/004-transactional-session-rotation/spec.md) | 2 | SE-07 | Approved; merged in #69, CI green, deployed to dev 23 October (`491f5a0`, smoke test passed); Done on owner review of the evidence |
| [Bounded re-encryption](../../specs/005-bounded-reencryption/spec.md) | 2 | EN-05, SE-05 | Approved; merged in #70, CI green, deployed to dev 23 October (`491f5a0`, smoke test passed); Done on owner review of the evidence |
| [Recurring restore check](../../specs/006-recurring-restore-check/spec.md) | 2 | EN-10, SE-05 | Draft; awaiting owner approval (decisions D-1 to D-5) |
| [Security review fixes](../../specs/007-security-review-fixes/spec.md) | 2 | SO-08, SE-07, EN-12, SO-03 | Approved (24 October, #74); implemented on the owner's direct instruction; awaiting merge, infra apply and deploy |

<!-- Add a row per feature directory, for example:
| [OTP login](../../specs/003-otp-login/spec.md) | 3 | AC-01, AC-02 | Draft |
-->

Status values: Draft (open for review), Approved (merged by the owner; code may start), Done
(every criterion passes, with evidence in implementation status).
