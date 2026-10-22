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
| [Rate-limit bypass](../../specs/002-rate-limit-bypass/spec.md) | 2 | SO-08, SE-08 | Done (#64) |
| [Transactional audit writes](../../specs/003-transactional-audit-writes/spec.md) | 2 | SE-05 | Draft (awaiting owner approval) |

<!-- Add a row per feature directory, for example:
| [OTP login](../../specs/003-otp-login/spec.md) | 3 | AC-01, AC-02 | Draft |
-->

Status values: Draft (open for review), Approved (merged by the owner; code may start), Done
(every criterion passes, with evidence in implementation status).
