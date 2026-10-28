# 0013. Retire spec-driven development and Spec Kit

- **Status:** Accepted (the owner's instruction, 28 October 2026)
- **Date:** 2026-10-28
- **Requirements:** none changed; supersedes [ADR 0007](0007-spec-driven-development.md) and
  [ADR 0011](0011-spec-kit-feature-specs.md)

## Context

ADR 0007 required an approved step spec before any code; ADR 0011 added GitHub Spec Kit feature
specs, a constitution with gates G1 to G4, and two CI checks (spec structure, spec linked to code
PRs). The owner decided on 28 October 2026 to stop working this way.

## Decision

Spec-driven development ends. Removed from the repository: the constitution, Spec Kit
(`.specify/`, the `speckit-*` Claude Code skills), the spec workflow page, the spec template,
`scripts/check-specs.mjs`, `scripts/check-pr-spec.mjs` and their CI jobs, and the spec rules in
`CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md` and the pull request template.

Existing step specs and feature specs (001 to 008, the Step 2 and draft Step 3 specs) move to
[`docs/archive/`](../archive/README.md) unchanged. They stay as the historical record that test
titles (`SE-07.14 …`) and the Step 2 evidence refer to. Nothing new is written there, and their
gates and approval states no longer apply.

Unchanged: requirement IDs, the guideline's steps and exit criteria, the definition of done, the
implementation-status rule and its CI check, and every security, data and infrastructure rule in
`CLAUDE.md` (including the owner's approval before applying infrastructure).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Remove the process, archive the specs | Keeps the evidence trail that tests and Step 2 records point to | A folder of documents nobody updates |
| Remove the process and delete the specs | Smallest repository | Criterion IDs in test titles and the Step 2 matrix would point to nothing |
| Keep spec-driven development | Written approval before code | The owner decided against it |

## Consequences

- Code no longer waits for an approved spec, and pull requests carry no `Spec:` or `Criteria:`
  lines. The `spec-exempt` label is no longer needed.
- Design decisions with trade-offs still go in an ADR.
- Documents that described the gates (implementation status, follow-up register, web roadmap,
  traceability matrix) were updated in the same pull request; dated reviews and audits keep their
  original wording, with links pointing at the archive.
