<!--
Sync Impact Report
- Version: template → 1.0.0 (first HEACH constitution, written by hand from the rules already
  agreed in CLAUDE.md, CONTRIBUTING.md, ADRs 0001 to 0010 and the requirements; ADR 0011)
- Principles added: I to IX (all derived; none is new policy)
- Sections added: Gates, Exceptions, Governance, Proposed amendments (not in force)
- Templates: .specify/templates/overrides/{spec,plan,tasks}-template.md written for HEACH
- Deferred: RATIFICATION_DATE is set when the owner merges the adoption pull request
-->

# HEACH Constitution

- **Status:** Proposed. In force once the owner merges the pull request that adds it
  ([ADR 0011](../../docs/adr/0011-spec-kit-feature-specs.md)).
- **Owns:** the principles and gates every spec, plan, task list and pull request is checked
  against. It does not restate the detail it points to: product requirements and their IDs live
  in [the requirements](../../docs/mvp-v1-requirements.md), delivery order in
  [the guideline](../../docs/mvp-v1-implementation-guideline.md), architecture in
  [the ADRs](../../docs/adr/README.md), completion in
  [implementation status](../../docs/implementation-status.md).

HEACH handles health data of patients in Odisha. Security and data protection come before speed
in every decision. Where this constitution and another document disagree, the pull request that
finds it fixes one of them; until then, the stricter rule applies.

## Core principles

### I. Spec before code

- Application code (`apps/`, `packages/`, `infra/`) for a step or feature starts only after its
  spec is **Approved and merged** on `main`: the step spec in `docs/specs/`, or the feature's
  `spec.md` and `plan.md` in `specs/<NNN-feature>/`.
- Behaviour that differs from the spec changes the spec (requirements, guideline, step spec or
  feature spec) in the same pull request or an earlier one, never afterwards. Nothing the spec
  does not say is implemented silently.
- `spec.md` says what and why (behaviour, permissions, data and its class, failures, screens);
  `plan.md` says how (contracts, migrations, encryption design, threat model, rollout).

Source: [ADR 0007](../../docs/adr/0007-spec-driven-development.md), ADR 0011.

### II. Stable, traceable acceptance criteria

- Every acceptance criterion has a stable ID of the form `<REQ-ID>.<n>` (for example `EN-03.1`),
  built on a requirement ID from the requirements. An ID is defined in exactly one spec and is
  never reused for different behaviour; a withdrawn criterion keeps its ID, marked withdrawn.
- Each criterion is proven by an automated test whose `describe` or `it` title starts with its
  ID, or by a manual check recorded with evidence in the spec or its evidence log.

Source: ADR 0007 decision 3.

### III. Data protection by design

- Every new data field has a class (Restricted, Confidential, Internal, Public) and a retention
  rule before it is built. Restricted fields are encrypted at field level through
  `@heach/crypto` (envelope encryption, per-domain keys, blind indexes for lookups); no
  improvised cryptography.
- Authorisation is enforced on the server for every request and every object, and proven by
  tests that other users and roles cannot read or change the data.
- Reads and writes of Restricted data and every admin action write an audit entry; consent is
  captured where the requirements ask for it (PR-01).
- Each module has a threat model before it is built, updated when the design changes (SO-01).

Source: requirements DC, EN, SE, PR, SO; CLAUDE.md working rules; Step 2 spec.

### IV. Synthetic data, no sensitive data in logs or secrets in code

- Development, test and fixture data is synthetic; real patient or provider data never leaves
  production (SO-07).
- No personal or health data in logs, URLs, error messages, analytics, SMS or push text. App
  code logs through `@heach/logger`, never `console.*`.
- No secrets in source, tests, fixtures, images or CI. gitleaks runs in hooks and CI and is never
  bypassed.

Source: CONTRIBUTING.md "Rules that are never relaxed"; EN-12, LM-02, SE-09.

### V. Odia, English and Hindi; accessible and fast on a mid-range phone

- Every user-facing string comes from `packages/i18n` with keys in Odia, English and Hindi
  (admin: English keys). Odia is the default locale; native review is required (I18N-07).
- UI meets WCAG 2.2 AA (A11Y), works at 360, 768 and 1280 px, and has loading, empty, error and
  offline states (UX-02, UX-04).
- Performance budgets are build gates (PF-02, PF-03, PF-06).

Source: requirements I18N, A11Y, UX, PF; definition of done.

### VI. Existing architecture, reuse, simplicity

- Work within the stack in CLAUDE.md and the ADRs; a change of architecture needs an ADR first.
  Infrastructure stays lean (ADR 0008) and in the project's single India Region.
- Reuse before creating; the plainest solution that meets the requirement; small units.
- Third parties sit behind an adapter interface with a test double (TS-06).
- A dependency outside the stack needs the owner's approval first: what it does, licence,
  maintenance status and the in-stack alternative.

Source: CLAUDE.md "Stack", "Code style"; ADRs 0001, 0008, 0009.

### VII. Evidence-based completion

- A pull request merges only when every CI job passes (ADR 0004: nothing enforces this but us).
- A requirement or step item is Done in implementation status only when it is met as written
  and every criterion has its proof; otherwise Partial with the gap stated.
- Any pull request that builds, extends or removes something a requirement ID or guideline step
  describes updates `docs/implementation-status.md` in the same pull request.
- The definition of done in the requirements applies to every feature.

Source: CLAUDE.md "Track implementation status"; ADR 0007 decision 4.

### VIII. Changes and accepted exceptions are written down

- A decision with trade-offs gets an ADR. A requirement relaxed for a stage is listed in an ADR
  with what replaces it and when it is revisited (pattern of ADRs 0004, 0009, 0010).
- An exception to a gate is accepted only in writing, by the owner, in the pull request or ADR
  that needs it, naming the gate, the reason and the end condition. It is never assumed.

Source: ADRs 0004, 0009, 0010; Step 2 spec decisions D1 to D6.

### IX. Humans approve; agents propose

- Agents (Claude Code and others) may draft specs, plans, tasks and code, but never mark a spec,
  ADR, checklist or this constitution Approved or Accepted, merge, deploy or apply
  infrastructure without the owner's authorisation for that action.
- Infrastructure is always planned first (`tofu plan`); anything that costs money, destroys or
  replaces is applied only with the owner's approval.

Source: CLAUDE.md "Infrastructure changes"; owner approvals recorded in project memory and the
Step 2 log.

## Gates

| Gate | Before | Passes when | Checked by |
| --- | --- | --- | --- |
| G1 Spec approved | Plan is approved | `spec.md` complete, no open `[NEEDS CLARIFICATION]`, owner approved | Owner review; `check-specs` (structure only) |
| G2 Plan approved | Any code for the feature | `plan.md` passes its Constitution Check; spec and plan merged as Approved | Owner review; `check-specs` |
| G3 Code pull request | Merge | Links an Approved spec and the criterion IDs it satisfies; status page updated; all CI jobs green | `check-pr-spec`, `status-check`, CI |
| G4 Done | Status set to Done | Every criterion has its test or manual evidence | Owner review of evidence |

Structural checks in CI prove that sections, links and IDs are present. They do not prove the
spec is correct, complete or approved; only human review does that.

## Exceptions

Legitimate pull requests that carry no spec link: docs-only and spec-only changes; changes
outside `apps/`, `packages/` and `infra/`; dependency bumps, refactors and fixes that change no
specified behaviour, labelled `spec-exempt` with a one-line reason in the pull request body.
Step 1 was built before ADR 0007 and has no spec.

## Governance

- This constitution changes by pull request only, with the owner's approval, using
  `/speckit-constitution` or a hand edit that keeps the Sync Impact Report current.
- Versioning: MAJOR when a principle is removed or redefined, MINOR when one is added or
  materially expanded, PATCH for wording.
- Each plan's Constitution Check lists every principle it touches and any violation with its
  justification; an unjustified violation stops the plan.

## Proposed amendments (not in force)

Listed in ADR 0011 for the owner to accept or reject. None is applied until accepted.

- **PA-1** `/speckit-analyze` reports no critical or high finding before a plan is approved.
- **PA-2** `/speckit-converge` reports Converged before a feature is marked Done.
- **PA-3** `tasks.md` is merged with the spec and plan (rather than with the first code pull
  request).
- **PA-4** Custom checklists from `/speckit-checklist` are ticked only by a human reviewer and
  must be fully ticked before G2.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): set when the owner merges the
adoption pull request | **Last Amended**: 2026-10-20
