# Step specs

One spec per guideline step, written and merged before that step's code starts
([ADR 0007](../adr/0007-spec-driven-development.md)). Copy [the template](0000-template.md) to
`step-NN-short-name.md`.

The [requirements](../mvp-v1-requirements.md) state _what_ in one line per ID; a step spec makes
each ID in the step testable. If writing a spec shows a requirement is wrong or unclear, change
the requirements in the same pull request.

| Spec | Step | Status |
| --- | --- | --- |
| [Secure foundation and quality gates](step-02-secure-foundation.md) | 2 | Approved on merge |

Step 1 was built before this rule; its record is in [implementation status](../implementation-status.md).

Status values: Draft (open for review), Approved (merged; code may start), Done (every criterion
passes).
