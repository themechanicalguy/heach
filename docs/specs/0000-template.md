# Step N: Title from the guideline

<!-- Step spec template (ADR 0007). From Step 3, a step spec may be a charter only: scope,
     out of scope, cross-feature decisions, threat model, and a "Feature specs" list linking
     specs/NNN-*/; criteria then live in those feature specs (ADR 0011). Each criterion ID is
     defined in exactly one spec. -->

- **Status:** Draft | Approved | Done
- **Guideline:** [Step N](../mvp-v1-implementation-guideline.md#step-n-anchor)
- **Requirements in scope:** IDs, for example EN-03, EN-04, SE-05
- **Out of scope:** what a reader might expect here but is deferred, with the step it moves to

## Acceptance criteria

One table per requirement ID. Each criterion is observable and testable. Its ID starts the title
of the test that proves it (`describe('EN-03.1 …')`), or "Manual" names the check when it cannot
be automated.

### EN-03 Field-level encryption

| ID | Given / when / then | Proof |
| --- | --- | --- |
| EN-03.1 | Given a Restricted field, when it is saved, then the database holds ciphertext only | Integration test |
| EN-03.2 | | |

## Data

Every new field, with its class (Restricted, Confidential, Internal, Public). Restricted fields
are encrypted at field level.

| Entity | Field | Class | Notes |
| --- | --- | --- | --- |
| | | | |

## API

| Method and path | Roles allowed | Request | Response | Errors |
| --- | --- | --- | --- | --- |
| | | | | |

## Threat model (SO-01)

Assets, entry points, threats (STRIDE is enough), and the mitigation and criterion ID for each.

| Threat | Mitigation | Criterion |
| --- | --- | --- |
| | | |

## Screens and languages

Screens touched, viewports (360, 768, 1280 px), states (loading, empty, error, offline), and new
i18n keys in Odia, English and Hindi. Omit for API-only steps.

## Open questions

Questions that block a criterion, with an owner. The spec is not Approved while one is open.
