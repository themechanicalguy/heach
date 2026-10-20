# Spec workflow with Spec Kit

How to take a feature from idea to merged code in HEACH with
[GitHub Spec Kit](https://github.com/github/spec-kit) and Claude Code. Why it works this way is
in [ADR 0011](adr/0011-spec-kit-feature-specs.md) (amending [ADR 0007](adr/0007-spec-driven-development.md));
the rules every artifact is checked against are in the
[constitution](../.specify/memory/constitution.md). This page only says how.

## Two levels of spec

| Level | Where | Holds | Approved by |
| --- | --- | --- | --- |
| Step spec | [`docs/specs/step-NN-*.md`](specs/README.md) | The step's charter: requirement IDs in scope, out of scope, cross-feature decisions, threat model, list of its feature specs. Step 2's also holds all its criteria (the baseline, unchanged) | Owner merges a docs-only PR |
| Feature spec | `specs/NNN-short-name/` | `spec.md` behaviour, `plan.md` design, `tasks.md` work | Owner merges a docs-only PR with `spec.md` and `plan.md` as Approved |

## One-time setup

Only needed to generate or regenerate artifacts; reading and reviewing them needs nothing.

```sh
# Python 3.11+ and uv are prerequisites. Pin the version this repository was set up with.
uv tool install specify-cli==1.2.0
specify version          # CLI Version 1.2.0
```

The repository is already initialised; do not run `specify init` again. It was set up with:

```sh
specify init --here --force --non-interactive --integration claude \
  --integration-options="--no-model-invocation" --script sh
```

What is committed and what stays local:

| Path | Committed | What it is |
| --- | --- | --- |
| `.specify/memory/constitution.md` | Yes | Principles and gates |
| `.specify/templates/overrides/` | Yes | HEACH spec, plan and tasks templates (take priority over the core ones) |
| `.specify/templates/`, `scripts/`, `workflows/`, `*.json` | Yes | Spec Kit managed files; change only by upgrade |
| `.claude/skills/speckit-*/` | Yes | The Claude Code skills |
| `.specify/feature.json` | No | Your current feature (per checkout) |
| `.claude/*` other than `skills/` | No | Claude Code local settings and state |

## Terminal or chat

- **Terminal**: `specify` (install, version, upgrade), `git`, `pnpm`, and the environment
  variable that selects a feature.
- **Claude Code chat**: the `/speckit-*` commands. Claude Code uses the hyphen form
  (`/speckit-specify`); the Spec Kit docs write the same command as `/speckit.specify`. The
  skills are user-invocable only: Claude never starts one by itself, so you type each command.

## The sequence

Review each result before the next command. Commands marked optional upstream are expected in
HEACH because the data is health data.

| # | In chat | Produces | Then |
| --- | --- | --- | --- |
| 0 | `/speckit-constitution <change>` | `.specify/memory/constitution.md` | Only to amend it: its own PR, owner approval |
| 1 | `/speckit-specify <what and why; step and requirement IDs>` | `specs/NNN-name/spec.md`, `checklists/requirements.md` | Read it; behaviour only, no tech |
| 2 | `/speckit-clarify [focus]` | Answers written into `spec.md` | Repeat until no `[NEEDS CLARIFICATION]` is left |
| 3 | `/speckit-plan <technical constraints>` | `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` | Constitution Check must pass |
| 4 | `/speckit-checklist [focus, e.g. security, i18n]` | `checklists/<focus>.md` | A human ticks items; the agent does not |
| 5 | `/speckit-tasks` | `tasks.md` | Each criterion ID has a test task |
| 6 | `/speckit-analyze` | Report only, no edits | Fix findings where they belong (spec, plan, tasks) and re-run |
| — | **Gate G1 and G2**: open a docs-only PR (`docs/NNN-name-spec`) with the feature directory, the step spec link and the index row. The owner reviews, sets Status to Approved and merges. Agents never set Approved. | | |
| 7 | `/speckit-implement [phase or story]` | Code and tests on a `feat/NNN-name` branch | Work in stages; `pnpm check` after each |
| 8 | `/speckit-converge` | Appends missing work to `tasks.md`, or reports Converged | Repeat 7 and 8 until Converged |
| — | **Gate G3**: code PR with `Spec:` and `Criteria:` lines, status page updated, all CI green. | | |

Example prompts for step 1 and step 3:

```text
/speckit-specify Step 3, feature "OTP login" (AC-01, AC-02, SE-07, SE-08): patients and providers
sign in with a mobile number and a one-time password in Odia, English or Hindi ...
/speckit-plan Use the existing NestJS auth module and the SMS adapter port with its test double;
sessions as in the Step 2 spec; no new dependency.
```

## Choosing and resuming a feature

`/speckit-specify` creates the next `specs/NNN-name/` and records it in `.specify/feature.json`.
Every later command works on that feature. The file is local, so:

- **Resume** in the same checkout: start Claude Code and run the next command.
- **Switch** feature, or resume in a fresh clone: in the terminal, before starting Claude Code,
  `export SPECIFY_FEATURE_DIRECTORY=specs/003-otp-login`. The next Spec Kit script writes it to
  `feature.json`.
- Spec Kit's optional `git` extension (branch per feature) is not installed; use the HEACH
  branch names above.

## Changing a spec

- Behaviour changes go into `spec.md` first, in the same or an earlier PR (ADR 0007 decision 2):
  edit it, or use `/speckit-specify` or `/speckit-clarify` on the selected feature, then
  `/speckit-plan` or `/speckit-tasks` again if they depend on it, then `/speckit-analyze`.
- Changing an Approved spec needs the owner's approval in that PR; say so in the PR body.
- A criterion ID is never reused: add a new number, and mark a dropped one "Withdrawn".
- A design-only change (no behaviour) changes `plan.md` and needs the same approval.
- An exception to a gate is written down by the owner (constitution VIII); it is never assumed.

## What CI checks, and what it does not

| Check | Workflow job | Proves |
| --- | --- | --- |
| `scripts/check-specs.mjs` | CI → Infra | Required sections in `spec.md` and `plan.md`; threat model rows; criterion IDs build on known requirement IDs and are defined once; Approved specs have a plan, no open questions or clarifications; the index lists every spec |
| `scripts/check-pr-spec.mjs` | Implementation status → Spec linked | A code PR names a spec Approved on the base branch and criterion IDs that spec defines, or has `spec-exempt` with a reason |
| Status check | Implementation status → Implementation status updated | A code PR updates `docs/implementation-status.md` or has `no-status-change` |

None of these proves that a spec is correct, complete or approved, or that the code meets it.
The owner's review does. Labels are honour-system on GitHub Free (ADR 0004).

## Upgrading Spec Kit

In a `chore/` PR: `uv tool install --force specify-cli==<version>`, then
`specify integration upgrade claude --integration-options="--no-model-invocation"`. Diff the
core templates against `.specify/templates/overrides/` for changed headings, run
`pnpm test:scripts` (a test fails if the overrides lose a required section), and update the
version here and in ADR 0011.
