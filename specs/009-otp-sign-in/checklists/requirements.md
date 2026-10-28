# Specification quality checklist: OTP sign-up and sign-in

**Purpose**: check spec.md is complete before planning is approved. A human reviewer ticks the
items; the agent that drafted the spec does not (constitution IX).

**Created**: 2026-10-28 | **Feature**: [spec.md](../spec.md)

## Content

- [ ] Behaviour only; no endpoints, tables or libraries in spec.md
- [ ] Every story names its journey and role and can be tested on its own
- [ ] Every edge case says what the user sees and what the system keeps

## Criteria

- [ ] Every criterion has an ID `<REQ-ID>.<n>` defined in no other spec
- [ ] Every criterion is testable, with its proof named
- [ ] Success criteria are measurable and reuse requirement targets

## Data and permissions

- [ ] Every new field has a class and a retention
- [ ] Every permission row has a criterion proving refusal
- [ ] The boundary with slices 3.2, 3.3, 3.5 and 3.9 is stated

## Readiness

- [ ] No `[NEEDS CLARIFICATION]` marker remains
- [ ] Every open question has an owner; none is left open at approval
