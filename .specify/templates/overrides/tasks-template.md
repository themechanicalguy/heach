---

description: "Task list template for HEACH feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `specs/[###-feature-name]/`

**Prerequisites**: spec.md and plan.md merged as Approved (constitution gate G2); research.md,
data-model.md, contracts/ when the plan produced them

**Tests**: Required in HEACH. Every criterion ID in spec.md has a test task whose test title
starts with that ID (`describe('AC-01.1 …')`), or a manual-check task that records evidence.

**Organization**: Tasks are grouped by user story so each story can be built and tested on its
own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, ...)
- Include exact file paths and the criterion IDs a task proves

## Path Conventions

Monorepo paths only: `apps/api/src/`, `apps/api/test/`, `apps/web/src/`, `apps/admin/src/`,
`packages/<name>/src/`, `infra/`. Reuse existing modules and `@heach/*` packages before adding
new ones.

<!--
  The tasks below are SAMPLES. /speckit-tasks replaces them with tasks from spec.md (stories,
  criterion IDs), plan.md (structure, data model, contracts, threat model, rollout) and
  data-model.md / contracts/. Do not keep sample tasks in the generated tasks.md.
-->

## Phase 1: Setup

- [ ] T001 Add the feature flag `[flag-name]`, off outside dev and test, in [path]
- [ ] T002 [P] Add i18n keys in Odia, English and Hindi in packages/i18n/[path]

---

## Phase 2: Foundational (blocks every story)

- [ ] T003 Migration for [table] with a DC class tag on every column in apps/api/[path]
- [ ] T004 [P] Field encryption and blind index for [field] through @heach/crypto in apps/api/[path]
- [ ] T005 [P] Adapter port and test double for [third party] in apps/api/[path]

**Checkpoint**: foundation ready; stories can start.

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [What this story delivers]

**Independent Test**: [How to verify it on its own]

### Tests for User Story 1 (write first; they fail before implementation)

- [ ] T006 [P] [US1] `[REQ-ID].1` integration test in apps/api/test/[name].int-spec.ts
- [ ] T007 [P] [US1] `[REQ-ID].2` authorisation test: other users and roles are refused, in apps/api/test/[name].int-spec.ts
- [ ] T008 [P] [US1] `[REQ-ID].3` E2E at 360, 768 and 1280 px with axe in apps/web/e2e/[name].spec.ts

### Implementation for User Story 1

- [ ] T009 [US1] [Service or controller] in apps/api/src/[module]/[file].ts
- [ ] T010 [US1] Audit entry for each Restricted read and write in apps/api/src/[module]/[file].ts
- [ ] T011 [US1] Screen with loading, empty, error and offline states in apps/web/src/[path]

**Checkpoint**: User Story 1 works and is tested on its own.

---

[Add more user story phases as needed, following the same pattern]

---

## Phase N: Verification and status

- [ ] TXXX Run `pnpm check`; regenerate `@heach/types` if routes or DTOs changed
- [ ] TXXX Review the generated OpenAPI against plan.md "API contracts"
- [ ] TXXX Record manual checks with evidence for criteria that cannot be automated
- [ ] TXXX Update docs/implementation-status.md for every requirement ID this changes (Done only when met as written)
- [ ] TXXX Run /speckit-converge and resolve what it appends

---

## Dependencies & Execution Order

- Setup → Foundational → user stories in priority order (or in parallel when independent) →
  Verification and status.
- Within a story: tests first and failing, then data, services, endpoints, screens.
- A task that changes behaviour not in spec.md stops; spec.md is changed and approved first.
