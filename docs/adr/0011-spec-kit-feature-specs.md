# 0011. Write feature specs with GitHub Spec Kit under the step specs

- **Status:** Proposed (accepted when the owner merges the adoption pull request)
- **Date:** 2026-10-20
- **Requirements:** SO-01, TS-01 to TS-09, all requirement IDs
- **Amends:** [ADR 0007](0007-spec-driven-development.md) decisions 1 and 5

## Context

ADR 0007 made development spec driven with one spec per guideline step. Step 2's spec worked
(74 criteria, each with a test or a recorded manual check), but Steps 3 to 9 each hold several
independent features (Step 3 alone covers accounts, Aadhaar and DigiLocker, onboarding and
verification). One document per step becomes too large to review, approves unrelated features
together, and mixes behaviour with technical design (endpoints, migrations, threat model).

GitHub Spec Kit (`specify-cli`, MIT, maintained by GitHub) structures each feature as a
directory of artifacts (`spec.md`, `plan.md`, `tasks.md`) produced by agent skills that Claude
Code runs (`/speckit-specify`, `/speckit-plan`, ...), and checks plans against a project
constitution. It is a development tool only: nothing ships in the product, it runs on the
developer's machine, and it adds no runtime or CI dependency.

## Decision

Keep ADR 0007's rules and add feature-level specs written with Spec Kit.

1. **Two levels of spec.**
   - A **step spec** (`docs/specs/step-NN-*.md`, ADR 0007) stays the step's charter: the
     requirement IDs in scope, what is out of scope, decisions that cross features, the step's
     threat model, and the list of feature specs that together cover it. It may also hold
     criteria directly, as Step 2's does.
   - A **feature spec** (`specs/NNN-short-name/`, created by `/speckit-specify`) covers one
     bounded slice of a step. `spec.md` holds behaviour (scope, journeys, criteria, permissions,
     failures, classified fields with retention, audit and consent, screens and languages);
     `plan.md` holds the design (data model and migrations, encryption, API contracts, threat
     model, rollout, verification); `tasks.md` the ordered work.
   - Each criterion ID is defined in exactly one spec, step or feature. CI checks this.
2. **Approval (amends ADR 0007 decision 1).** Code for a feature starts only after its
   `spec.md` and `plan.md` are merged to `main` with Status Approved, in a docs-only pull
   request the owner approves. A step spec is approved before or with its first feature spec.
   Specs written before this ADR (Step 2) stay valid as they are; Step 2's spec is the baseline
   and is not rewritten.
3. **API contract (amends ADR 0007 decision 5).** For feature specs, endpoints and their roles
   are defined in `plan.md` "API contracts" (detail in `contracts/`), with permissions and data
   classes in `spec.md`. The OpenAPI file stays generated from NestJS; review checks it against
   the plan.
4. **Constitution.** `.specify/memory/constitution.md` owns principles and gates. It is derived
   from rules already agreed (CLAUDE.md, CONTRIBUTING.md, ADRs, requirements) and adds no new
   policy; proposed new policy is listed under "Proposed amendments" until the owner accepts it.
5. **Spec persistence.** `spec.md` is a living contract: a change of behaviour changes it first
   (ADR 0007 decision 2), in the same or an earlier pull request. Feature directories are not
   deleted when done.
6. **Document ownership.** Each kind of content has one home; others link to it:

   | Content | Owner |
   | --- | --- |
   | Product requirements and IDs | `docs/mvp-v1-requirements.md` |
   | Delivery stages | `docs/mvp-v1-implementation-guideline.md` |
   | Architecture decisions | `docs/adr/` |
   | Principles and gates | `.specify/memory/constitution.md` |
   | Step charters and Step 2 criteria | `docs/specs/step-NN-*.md` (index: `docs/specs/README.md`) |
   | Feature behaviour, design and tasks | `specs/NNN-*/` |
   | Completion and evidence | `docs/implementation-status.md` (and step evidence logs) |
   | How to run the workflow | `docs/spec-workflow.md` |

7. **Tooling.** Spec Kit 1.2.0 (`specify init --here --integration claude
   --integration-options="--no-model-invocation" --script sh`), no extensions, no presets.
   HEACH sections live in `.specify/templates/overrides/` so an upgrade does not overwrite them.
   The skills are user-invocable only, so an agent cannot start `/speckit-implement` or any other
   step on its own; the human types each command.
8. **Enforcement.** CI checks structure, not meaning: `scripts/check-specs.mjs` (required
   sections, threat model rows, known requirement IDs, unique criterion IDs, index entries, no
   open questions in an Approved spec) and `scripts/check-pr-spec.mjs` (a code pull request names
   a spec that is Approved on the base branch and the criterion IDs it satisfies; label
   `spec-exempt` with a reason for changes that alter no specified behaviour). Passing them does
   not mean a spec is right or approved.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Spec Kit feature specs under step specs (chosen) | Reviewable slices; behaviour and design separated; constitution check in every plan; agent skills keep artifacts consistent | A tool to keep current; two spec locations to explain |
| Keep one spec per step only (ADR 0007 as is) | Nothing new | Step 3+ specs too large; unrelated features approved together |
| Hand-written feature specs from a template, no Spec Kit | No tool | No clarify, analyze or converge passes; consistency checks by hand |
| Spec Kit replacing step specs | One location | Loses the step charter and the approved Step 2 baseline; IDs would move |

## Consequences

- Step 3 starts with a step charter and its first feature spec, both in docs-only pull requests.
- Developers install `specify-cli` 1.2.0 to regenerate artifacts; reading and reviewing them needs
  nothing. Upgrades are a reviewed `chore` pull request (`specify integration upgrade claude`),
  after checking the overrides still match the upstream templates' headings.
- `/speckit-taskstoissues` is installed but deprecated upstream; HEACH does not use it.
- Open for the owner (not in force until accepted): constitution amendments PA-1 to PA-4, the
  `spec-exempt` label, and user-invocable-only skills.
- Revisit if Spec Kit stops being maintained, if its templates change shape in a way the overrides
  cannot follow, or if feature specs routinely need more review time than the code they govern.
