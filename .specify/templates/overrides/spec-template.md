# Feature Specification: [FEATURE NAME]

**Status**: Draft

**Step**: [Step N spec](../../docs/specs/step-NN-short-name.md) of the [guideline](../../docs/mvp-v1-implementation-guideline.md)

**Requirements in scope**: [Requirement IDs from docs/mvp-v1-requirements.md, for example AC-01, AC-02, PR-01]

**Approval**: [Owner, date and pull request that merged this spec as Approved; empty while Draft]

**Created**: [DATE]

**Input**: User description: "$ARGUMENTS"

<!--
  HEACH feature spec (ADR 0011). This file says WHAT and WHY: behaviour, permissions, data and
  its class, failures, screens. HOW (contracts, migrations, encryption design, threat model,
  rollout) belongs in plan.md. Do not restate requirements or ADRs; cite their IDs.
  Only the owner sets Status to Approved, by merging it. Agents leave it Draft.
  CI (scripts/check-specs.mjs) checks that every heading below exists; it cannot check that the
  content is right.
-->

## Scope

[What this feature delivers, in two to four sentences, and which part of the step it covers.]

**Out of scope**: [What a reader might expect here but is deferred, with the step or feature it moves to.]

## User Scenarios & Testing *(mandatory)*

<!--
  One story per journey slice, priority ordered (P1 first), each independently testable.
  Name the journey from the requirements (J1 to J9) and the role. Reference the acceptance
  criterion IDs from Functional Requirements instead of repeating them.
-->

### User Story 1 - [Brief Title] (Priority: P1)

**Journey and role**: [J1, provider | patient | admin | lab]

[Describe this user journey in plain language.]

**Why this priority**: [Value, and why it comes first]

**Independent Test**: [How it can be tested on its own]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome] ([REQ-ID].1)

---

### Edge Cases and failures

<!-- Every failure the user can meet: invalid input, expired or reused tokens, third party down
     or slow, offline, duplicate submission, concurrent change, rate limit, unauthorised access.
     Say what the user sees and what the system keeps or rolls back. -->

- What happens when [boundary condition or failure]? [Behaviour] ([REQ-ID].n)

## Requirements *(mandatory)*

### Functional Requirements

<!--
  In HEACH the functional requirements ARE the acceptance criteria. Use stable IDs
  `<REQ-ID>.<n>` built on a requirement ID (for example AC-01.1), not FR-###. An ID is defined
  in exactly one spec (CI checks this) and is never reused for other behaviour. The ID starts
  the title of the test that proves it, or Proof says "Manual: <check>" with where the evidence
  is recorded. Mark unknowns with [NEEDS CLARIFICATION: question].
-->

| ID | Given / when / then | Proof |
| --- | --- | --- |
| [REQ-ID].1 | Given [state], when [action], then [observable outcome] | [Unit / integration / E2E test, or Manual: check] |

### Permissions

<!-- Who may do what, on whose objects. Every cell is enforced on the server (SE-02) and has a
     criterion proving that other users and roles are refused. -->

| Action | Patient | Provider | Admin | Other | Criterion |
| --- | --- | --- | --- | --- | --- |
| [Action] | [Own only / no] | [Own bookings only / no] | [Break-glass only / no] | [No] | [REQ-ID].n |

### Key Entities and data classification

<!-- Every new or changed field: class (Restricted, Confidential, Internal, Public, as in the
     requirements' DC section) and retention (PR-05). Restricted fields are encrypted at field
     level; plan.md says how. Collect only what the feature needs (PR-02). Write "None" if the
     feature adds no data. -->

| Entity | Field | Class | Retention | Notes |
| --- | --- | --- | --- | --- |
| [Entity] | [field] | [Restricted] | [Until account deletion + N days] | [Lookup by blind index] |

### Audit and consent

<!-- Which reads and writes are audited (every Restricted read and write and every admin action,
     SE-05), what the patient can see of it (SE-06), and which consent is captured, in which
     language, and how it is withdrawn (PR-01). Write "None" with the reason if not applicable. -->

- **Audited**: [event, actor, object; never the Restricted value itself]
- **Consent**: [purpose, when asked, withdrawal]

## Screens, languages and accessibility

<!-- Omit only for API-only features, and say so. -->

- **Screens**: [routes touched]
- **States**: loading, empty, error and offline for each screen (UX-04)
- **Viewports**: 360, 768 and 1280 px (UX-02); admin desktop first
- **Languages**: new i18n keys in Odia, English and Hindi (admin: English); text expansion 40% (I18N-06)
- **Accessibility**: WCAG 2.2 AA; keyboard and screen-reader path; labels and error summary (A11Y-01 to A11Y-05)

## Success Criteria *(mandatory)*

### Measurable Outcomes

<!-- Technology-agnostic and measurable. Reuse targets from the requirements (PF, UX-06) rather
     than inventing new ones. -->

- **SC-001**: [Measurable outcome]

## Assumptions

- [Assumption, and what changes if it is wrong]

## Open questions

<!-- Questions that block a criterion, each with an owner. The spec cannot be Approved while a
     row is open. Write "None" when there are none. -->

| Question | Blocks | Owner |
| --- | --- | --- |
| [Question] | [REQ-ID].n | [Owner] |
