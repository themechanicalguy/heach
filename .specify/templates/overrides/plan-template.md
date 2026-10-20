# Implementation Plan: [FEATURE]

**Status**: Draft

**Spec**: [spec.md](spec.md) | **Date**: [DATE] | **Approval**: [Owner, date and pull request; empty while Draft]

**Input**: Feature specification from `specs/[###-feature-name]/spec.md`

<!--
  HEACH plan (ADR 0011). This file says HOW: architecture, contracts, migrations, encryption
  design, threat model, rollout and verification. Behaviour stays in spec.md; if planning shows
  the behaviour must change, change spec.md first. Only the owner sets Status to Approved.
  Code starts only after spec.md and plan.md are merged as Approved (constitution gate G2).
-->

## Summary

[Primary requirement and the technical approach, in a few sentences.]

## Technical Context

<!-- Fixed by CLAUDE.md and the ADRs; state only what this feature adds or changes. A new
     dependency outside the stack needs the owner's approval first (constitution VI). -->

**Apps and packages touched**: [apps/api, apps/web, packages/crypto, ...]

**New dependencies**: [None, or name, licence, maintenance status, in-stack alternative, approval status]

**Storage**: [PostgreSQL tables, Redis keys, object storage prefixes]

**Third parties**: [Adapter port and its test double (TS-06), or None]

**Constraints**: [Single India Region (ap-south-1), lean host (ADR 0008), budgets (PF)]

## Constitution Check

*GATE: Must pass before research. Re-check after design.*

| Principle | How this plan meets it | Violation and justification |
| --- | --- | --- |
| I Spec before code | | |
| II Traceable criteria | | |
| III Data protection | | |
| IV Synthetic data, logs, secrets | | |
| V Languages, accessibility, performance | | |
| VI Architecture, reuse, dependencies | | |
| VII Evidence-based completion | | |
| VIII Changes and exceptions | | |
| IX Humans approve | | |

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── spec.md              # Behaviour (/speckit-specify, /speckit-clarify)
├── plan.md              # This file (/speckit-plan)
├── research.md          # Phase 0 output (/speckit-plan)
├── data-model.md        # Phase 1 output (/speckit-plan)
├── quickstart.md        # Phase 1 output (/speckit-plan)
├── contracts/           # Phase 1 output (/speckit-plan)
├── checklists/          # /speckit-specify and /speckit-checklist
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

<!-- Real paths in the monorepo only (apps/web, apps/admin, apps/api, packages/*, infra/). -->

```text
apps/api/src/[module]/
apps/web/src/app/[locale]/[route]/
packages/[package]/src/
```

## Data model and migrations

<!-- Tables and columns with the class from spec.md; the DC-01 class tag on every column;
     forward migration and how it is rolled back or made safe to roll forward (EN-10.1). -->

## Encryption and keys

<!-- For each Restricted field: key domain (health, identity, payments, documents), envelope
     encryption through @heach/crypto, blind index for lookups (EN-09). Write "None: no
     Restricted data" if so. -->

## API contracts

<!-- Each endpoint: method and path, roles allowed, request and response fields with class,
     error cases. Detailed schemas go in contracts/. The generated OpenAPI is reviewed against
     this section. Write "None" for features without API changes. -->

| Method and path | Roles allowed | Request | Response | Errors |
| --- | --- | --- | --- | --- |
| | | | | |

## Audit, logging and monitoring

<!-- Audit events written (SE-05) and where; logs and metrics added (LM-01, LM-05, LM-06),
     confirming no personal or health data in them; alerts. -->

## Threat model

<!-- SO-01. Assets, entry points, threats (STRIDE is enough), mitigation and the criterion ID
     that proves it. CI fails if this table has no rows. -->

| Threat | Mitigation | Criterion |
| --- | --- | --- |
| | | |

## Rollout

<!-- Feature flag and its default per environment, migration order, data backfill, how to turn
     it off, and what the owner must approve (infra plan, cost). -->

## Verification

<!-- Every criterion ID from spec.md and how it is proven: test file and title, or the manual
     check and where its evidence will be recorded. -->

| Criterion | Proof | Where |
| --- | --- | --- |
| | | |

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
