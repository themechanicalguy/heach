# Feature Specification: Nested log masking

**Status**: Draft

**Step**: [Step 2 spec](../../step-specs/step-02-secure-foundation.md) of the [guideline](../../../mvp-v1-implementation-guideline.md) (closes the LM-02.1 gap before Step 3 logs mobile numbers)

**Requirements in scope**: LM-02 (no personal or health data in logs; masking by a shared logger); LM-01 (correlation and trace IDs stay readable); SO-01 (threat model, in plan.md); TS-01 (test evidence)

**Approval**:

**Created**: 2026-10-28

**Input**: [Follow-up register FU-27](../../../follow-up-register.md#closes-step-2): the 25 October 2026 [audit](../../../step-1-2-audit.md) found LM-02.1 unmet for nested input (review S-6)

## Scope

`@heach/logger` today redacts personal keys only at the top level and one level down, and masks
mobile numbers only in the message and in top-level string values. The audit's synthetic probe
wrote a number in clear at `req.query.phone` and inside a nested string. No current call site logs
nested personal data, so nothing has leaked.

This feature makes the logger apply the same protection at every depth of every value it writes:
the object passed to a log call, interpolation arguments, child-logger bindings, context fields and
errors. Where it cannot inspect a value safely (too deep, circular, binary), it writes a placeholder
instead of the value. It amends no Step 2 criterion; with the new criteria below, LM-02.1 is met as
written for nested input, and LM-02 can return to Done.

**Out of scope**:

- Detecting names, addresses or health text by their content. Only mobile numbers have a pattern
  that is safe to match. Everything else is caught by its key. Not logging personal data at all
  stays the rule (constitution IV); masking is the safety net.
- Aadhaar numbers, email addresses and other identifiers by value. Step 3 adds them (KY, AC) when
  it starts handling them. The key list already covers `aadhaar` and `email`.
- Front-end logging and error tracking (LM-03): they do not use `@heach/logger`.
- Log retention and shipping (LM-05, ADR 0010).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Personal data nested inside a logged object never reaches the log (Priority: P1)

**Journey and role**: a developer or an operator reading API and job logs; the patient or provider whose data passes through a request

A developer logs a request, a DTO or an adapter response without thinking about how deep the
personal fields sit. Every value under a personal key is redacted, and every mobile number inside
any string is masked, however deep it is, inside arrays and inside errors. Correlation IDs, trace
IDs, run IDs and counts stay readable.

**Why this priority**: Step 3 brings OTP sign-in and onboarding. Their objects carry mobile numbers
and names two or more levels deep. The fix must land before that code exists.

**Independent Test**: log the audit's probe objects and a three-level object with personal keys,
numbers in nested strings, arrays and an error. Then check the output holds none of the synthetic
values and keeps the IDs.

**Acceptance Scenarios**:

1. **Given** `{ req: { query: { phone: '<synthetic number>' } } }`, **When** it is logged, **Then** the number is absent and the value reads `[REDACTED]` (LM-02.3)
2. **Given** `{ req: { detail: 'call <synthetic number>' } }`, **When** it is logged, **Then** the string reads `call [MOBILE]` (LM-02.4)
3. **Given** an error whose message holds a synthetic number, **When** it is logged as `err`, **Then** the message and stack are masked and the error type is kept (LM-02.5)

---

### User Story 2 - Values the logger cannot inspect fail closed (Priority: P2)

**Journey and role**: an operator; a developer logging an unusual object

A very deep, circular or binary value is replaced by a placeholder rather than written unchecked.
The log line is still written, so the event is not lost.

**Independent Test**: log an object nested past the depth cap, a circular object and a buffer.
Each produces one log line, with placeholders and without the synthetic values.

**Acceptance Scenarios**:

1. **Given** an object nested deeper than the depth cap with a number at the bottom, **When** it is logged, **Then** the part beyond the cap reads `[DEPTH]` and the number is absent (LM-02.6)
2. **Given** a circular object, **When** it is logged, **Then** one line is written with `[CIRCULAR]` where the cycle closes (LM-02.6)

### Edge Cases and failures

- Key letter case and separators: `Phone`, `PHONE`, `phone_number`, `mobile-no`, `patientName` and `x-authorization` are personal keys. A key is split into words at case changes, `_`, `-` and `.`, and is redacted if any word is a personal word (LM-02.3).
- Harmless keys that contain a personal word, such as `serviceName` or `tokenCount`, are redacted too. This fails closed on purpose; rename the field if its value is needed in logs (LM-02.3).
- Arrays: each element is processed as a value at the next depth; an array under a personal key is redacted whole (LM-02.3, LM-02.4).
- Interpolation arguments (`logger.info('sent to %s', number)` or an object passed for `%o`) are processed like the merge object (LM-02.7).
- Child loggers: bindings given to `logger.child({...})` are processed once, when the child is created (LM-02.7).
- Context fields from `context()` (correlation ID, role, trace ID) are processed too, and hex IDs, span IDs and UUIDs stay readable (LM-02.1 existing test, LM-02.8).
- Numbers held as numbers (`9876543210` as a JavaScript number) under a non-personal key are masked like strings (LM-02.4).
- Dates, booleans, `null` and `undefined` are written unchanged. Buffers and typed arrays become `[BINARY]` (LM-02.6).
- A getter that throws, or a value that cannot be read: the field becomes `[UNREADABLE]` and the line is still written (LM-02.6).
- The caller's object is never changed by logging (LM-02.8).

## Requirements _(mandatory)_

### Functional Requirements

These add to LM-02.1 in the [Step 2 spec](../../step-specs/step-02-secure-foundation.md#acceptance-criteria) (unchanged). The depth cap is 8 levels below the log call's object.

| ID      | Given / when / then                                                                                                                                                                                                                                              | Proof                                                                                                                                                    |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LM-02.3 | Given a value under a personal key (the list in `@heach/logger`, matched by word in any letter case and separator) at any depth up to the cap, including in arrays, when it is logged, then the value is written as `[REDACTED]` whatever its type               | Unit tests in `packages/logger/src/index.test.ts` titled `LM-02.3 …`, including the audit probe `{ req: { query: { phone } } }` and a three-level object |
| LM-02.4 | Given a mobile number (as matched today, with or without +91) inside any string or number at any depth up to the cap, under any key, including array elements, when it is logged, then it is written as `[MOBILE]` and the rest of the string is kept            | Unit tests titled `LM-02.4 …`, including the audit probe `{ req: { detail: 'call …' } }`                                                                 |
| LM-02.5 | Given an `Error` (or subclass) anywhere in a log call, when it is logged, then its type is kept, its message and stack are masked as in LM-02.4, and its other own fields are processed as in LM-02.3 and LM-02.4                                                | Unit tests titled `LM-02.5 …`                                                                                                                            |
| LM-02.6 | Given a value deeper than the cap, a circular reference, binary data or a field that cannot be read, when it is logged, then exactly one line is written with `[DEPTH]`, `[CIRCULAR]`, `[BINARY]` or `[UNREADABLE]` in its place and no synthetic personal value | Unit tests titled `LM-02.6 …`                                                                                                                            |
| LM-02.7 | Given personal data in interpolation arguments, child-logger bindings or `context()` fields, when a line is written, then LM-02.3 to LM-02.5 apply to them as to the merge object                                                                                | Unit tests titled `LM-02.7 …`                                                                                                                            |
| LM-02.8 | Given any log call, when it is processed, then the caller's object is unchanged afterwards, and correlation IDs, trace IDs, span IDs, UUIDs, run IDs and counts under non-personal keys are written unchanged                                                    | Unit tests titled `LM-02.8 …`; existing LM-01.1 and LM-02.1 tests stay green                                                                             |

### Permissions

No change. Logs are read by developers and operators as today; this feature only changes what a
log line contains.

| Action    | Patient | Provider | Admin                         | Other                                     | Criterion         |
| --------- | ------- | -------- | ----------------------------- | ----------------------------------------- | ----------------- |
| Read logs | No      | No       | No (operators only, as today) | Developers and operators with host access | Unchanged (LM-05) |

### Key Entities and data classification

None. No new data is stored. Log lines are Internal and must hold no Restricted or Confidential
values (LM-02); this feature enforces that more deeply.

### Audit and consent

- **Audited**: None. Logging is not an audited action (SE-05 unchanged).
- **Consent**: None. No personal data is collected or used.

## Screens, languages and accessibility

None: a shared package with no screen or user-facing string.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The audit's probe (top-level string, `phone` at depth 0, 1 and 2, a number in a nested string), re-run against the built package, writes 0 synthetic numbers in clear.
- **SC-002**: A test corpus of at least 20 shapes (nested objects, arrays, errors, child bindings, interpolation, mixed-case keys, depth cap, cycles, buffers) writes 0 of its synthetic personal values in clear.
- **SC-003**: Every existing logger, API and job test passes unchanged. Existing log lines from app call sites (run IDs, counts, error names, scopes) are written exactly as before.

## Assumptions

- Depth cap of 8 levels: deep enough for request objects and adapter responses seen today (at most 4 levels). If a legitimate log needs more, it is flattened by the caller, not by raising the cap.
- Matching keys by word fails closed: some harmless fields (`serviceName`, `fileName`) will be redacted. No current app call site uses such a key (checked on `main` `5181472`: keys are `scope`, `alert`, `detail`, `error`, `runId`, `domain`, `targetVersion`, `dump` and counts). If one is needed, rename it.
- The personal key list stays as in `@heach/logger` today, matched by word. Step 3 adds keys when it adds fields (its specs say so).
- Mobile numbers are the only value pattern. A name or a health note under a non-personal key cannot be detected; the rule that call sites never pass them (constitution IV, LM-02) still applies, and review checks it.

## Open questions

None.
