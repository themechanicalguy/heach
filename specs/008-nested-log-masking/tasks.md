---
description: 'Tasks for spec 008, nested log masking'
---

# Tasks: Nested log masking

**Input**: [spec.md](spec.md), [plan.md](plan.md)

**Prerequisites**: spec.md and plan.md merged as Approved (constitution gate G2). Not met on
28 October 2026: both are Draft. Redrafted on 28 October 2026 because the earlier draft
(`eb12224`, named in the web roadmap) is not in the repository.

**Tests**: every criterion has a test whose title starts with its ID. Tests are written first and
must fail against the current logger before the implementation task.

**Organization**: one package, two stories; story 2 depends on the pass built for story 1.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

None: no flag (plan, Rollout), no dependency, no i18n key.

## Phase 2: Foundational

- [ ] T001 Run the audit's probe (spec SC-001) against the current `packages/logger/dist` and keep its output as the "before" line in Evidence below; it must show the synthetic number in clear

**Checkpoint**: the failure is reproduced.

## Phase 3: User Story 1 - Personal data nested inside a logged object never reaches the log (P1) 🎯 MVP

**Goal**: one recursive pass redacts personal keys and masks mobile numbers at every depth and at
every entry point.

**Independent Test**: `pnpm --filter @heach/logger test` with the new tests; the probe writes no
synthetic number.

### Tests for User Story 1 (write first; they fail before implementation)

- [ ] T002 [P] [US1] `LM-02.3` tests in `packages/logger/src/sanitize.test.ts`: personal keys at depth 2 and 3, in arrays, in camel, snake, kebab and upper case; and in `packages/logger/src/index.test.ts`: the audit probe `{ req: { query: { phone } } }` through `createLogger`
- [ ] T003 [P] [US1] `LM-02.4` tests in `sanitize.test.ts`: numbers with and without +91 inside nested strings, array elements and numbers; and in `index.test.ts`: the probe `{ req: { detail: 'call …' } }`
- [ ] T004 [P] [US1] `LM-02.5` tests in `sanitize.test.ts` and `index.test.ts`: an `Error` subclass under `err` and as the first argument of `logger.error(err)` keeps its type; message and stack masked; own fields processed
- [ ] T005 [P] [US1] `LM-02.7` tests in `index.test.ts`: interpolation arguments, `child()` bindings at two levels, and `context()` fields
- [ ] T006 [P] [US1] `LM-02.8` tests in `sanitize.test.ts`: input deep-equal to a copy taken before the call; correlation, trace and span IDs, UUIDs, run IDs and counts under non-personal keys unchanged

### Implementation for User Story 1

- [ ] T007 [US1] `isPersonalKey` (word split at case changes, `_`, `-`, `.`, spaces) and `sanitizeLogValue` rules 1, 2, 4, 5 and 6 of the plan in new `packages/logger/src/sanitize.ts`; pure, returns new values, never throws
- [ ] T008 [US1] Wire the pass in `packages/logger/src/index.ts`: `formatters.log` replaces `maskStrings`; `hooks.logMethod` passes every argument and wraps a leading `Error` as `{ err }` with a masked message; `serializers.err` set to identity; `child()` wrapped so bindings pass through first; remove `DEFAULT_REDACT_PATHS` (keep the `redact` option for exact extra paths)
- [ ] T009 [US1] Confirm no importer of `DEFAULT_REDACT_PATHS` outside the package: `grep -rn DEFAULT_REDACT_PATHS apps packages --include=*.ts` returns only `packages/logger`

**Checkpoint**: T002 to T006 pass; existing `LM-01.1` and `LM-02.1` tests pass unchanged.

## Phase 4: User Story 2 - Values the logger cannot inspect fail closed (P2)

**Goal**: depth cap, cycles, binary data and unreadable fields become placeholders.

**Independent Test**: the `LM-02.6` tests alone.

- [ ] T010 [P] [US2] `LM-02.6` tests in `sanitize.test.ts`: depth 9 gives `[DEPTH]`; a self-reference gives `[CIRCULAR]` while a repeated, non-circular reference is written twice; `Buffer`, `ArrayBuffer` and `Uint8Array` give `[BINARY]`; a getter that throws gives `[UNREADABLE]`; exactly one line written each time
- [ ] T011 [US2] Rules 1 (depth, path-based cycle detection) and 3 (binary) and the `[UNREADABLE]` catch in `packages/logger/src/sanitize.ts`

**Checkpoint**: LM-02.3 to LM-02.8 pass.

## Phase 5: Verification and status

- [ ] T012 [P] SC-002 corpus: a table-driven test of at least 20 shapes (nested objects, arrays, errors, child bindings, interpolation, mixed-case keys, depth cap, cycles, buffers) in `sanitize.test.ts`, asserting 0 synthetic values in clear
- [ ] T013 SC-001: build the package and re-run the T001 probe; record the "after" output in Evidence (0 synthetic numbers in clear)
- [ ] T014 SC-003: `pnpm check` green; API and job tests unchanged; `grep -rn 'console\.' packages/logger/src` returns nothing new
- [ ] T015 Update `docs/implementation-status.md`: LM-02 back to Done if LM-02.1 to LM-02.8 all pass, with the "Last updated" line; follow-up register FU-27 to Closed with the PR link; specs index row
- [ ] T016 Code PR `feat/008-nested-log-masking` with `Spec: specs/008-nested-log-masking/spec.md` and `Criteria: LM-02.3, LM-02.4, LM-02.5, LM-02.6, LM-02.7, LM-02.8`
- [ ] T017 Owner: G4 acceptance of the evidence (constitution IX). Not an agent task

## Dependencies & Execution Order

- T001 first. T002 to T006 in parallel, then T007, T008, T009. Story 2 (T010, T011) after T007.
- T012 to T016 after both stories. T017 after merge.

## Evidence

Filled in by the code PR: probe output before (T001) and after (T013), with the commit and date.
