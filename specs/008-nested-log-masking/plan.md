# Implementation Plan: Nested log masking

**Status**: Draft

**Spec**: [spec.md](spec.md) | **Date**: 2026-10-28 | **Approval**:

**Input**: Feature specification from `specs/008-nested-log-masking/spec.md`

## Summary

Replace the logger's two shallow protections with one recursive pass: pino `redact` paths
`key` and `*.key`, and `maskStrings` on top-level values only. A pure function
`sanitizeLogValue(value)` walks a value up to the depth cap. It redacts values under personal keys
(matched by word), masks mobile numbers in strings and numbers, serializes errors, and puts a
placeholder where a value is too deep, circular, binary or unreadable. It returns a new value and
never changes the input. `createLogger` applies it at every place pino lets data into a line. Each
place was checked against pino 10.4.0 source (`lib/proto.js`, `lib/tools.js`) on 28 October 2026.

| Entry point                         | pino behaviour (10.4.0)                                                                               | Where the pass runs                                                                                                                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Merge object and `context()` fields | `mixin` is merged into the object before `formatters.log`                                             | `formatters.log` (replaces `maskStrings`)                                                                                                                                                                 |
| Errors in the merge object          | `formatters.log` sees the `Error` instance; the default `err` serializer runs after it                | The pass serializes the error itself with `pino.stdSerializers.err`, then masks; the logger sets `serializers.err` to identity so the error is not serialized twice (otherwise its type becomes `Object`) |
| `logger.error(err)` with no message | pino wraps it as `{ err }` and takes the message from `err.message` without passing it through a hook | `hooks.logMethod` wraps a leading `Error` as `{ err }` and supplies the masked message itself                                                                                                             |
| Message and interpolation arguments | Formatted after `hooks.logMethod`                                                                     | `hooks.logMethod` passes every argument through the pass (strings were masked already)                                                                                                                    |
| Child bindings                      | `formatters.bindings` runs for the root only; children skip it                                        | `createLogger` wraps `child()` so bindings pass through the pass before pino stores them; grandchildren inherit the wrapper                                                                               |

## Technical Context

**Apps and packages touched**: `packages/logger` only. `apps/api` call sites are unchanged.

**New dependencies**: None.

**Storage**: None.

**Third parties**: None.

**Constraints**: Logging stays synchronous and in process. The pass is linear in the size of the
logged value and stops at the depth cap.

## Constitution Check

_GATE: Must pass before research. Re-check after design._

| Principle                               | How this plan meets it                                                                                               | Violation and justification |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| I Spec before code                      | Spec and plan go in a docs-only PR; code waits until both are merged as Approved                                     | None                        |
| II Traceable criteria                   | LM-02.3 to LM-02.8 each have unit tests whose titles start with the ID (Verification)                                | None                        |
| III Data protection                     | Strengthens LM-02: fails closed on unknown, deep or unreadable values                                                | None                        |
| IV Synthetic data, logs, secrets        | Tests use synthetic numbers (`98765432xx`) and names only                                                            | None                        |
| V Languages, accessibility, performance | No UI. Cost is one walk per log call, bounded by the cap                                                             | None                        |
| VI Architecture, reuse, dependencies    | Reuses `maskValue` and the key list in `@heach/logger`; pure function in its own file; no dependency                 | None                        |
| VII Evidence-based completion           | SC-001 probe re-run and recorded in tasks evidence; status page updated in the code PR                               | None                        |
| VIII Changes and exceptions             | Adds criteria; amends none. Removing the `DEFAULT_REDACT_PATHS` export is internal (no importer outside the package) | None                        |
| IX Humans approve                       | Owner approves by a PR comment; agent leaves Status Draft                                                            | None                        |

## Project Structure

### Documentation (this feature)

```text
specs/008-nested-log-masking/
├── spec.md
├── plan.md
└── tasks.md        # with the code PR
```

### Source Code (repository root)

```text
packages/logger/src/
├── index.ts            # createLogger wiring: formatters.log, logMethod, child wrapper, err serializer
├── sanitize.ts         # sanitizeLogValue, isPersonalKey, placeholders (new, pure)
├── sanitize.test.ts    # LM-02.3 to LM-02.6, LM-02.8 on the pure function (new)
└── index.test.ts       # LM-02.7 and the end-to-end probe through createLogger (extended)
```

## Data model and migrations

None.

## Encryption and keys

None: no Restricted data is stored.

## API contracts

None. Public package API: `createLogger`, `maskValue` and `Logger` are unchanged. The new export
`sanitizeLogValue` exists for tests. `DEFAULT_REDACT_PATHS` is removed: nothing outside the package
imports it. The `redact` option stays for exact extra paths and still uses pino `redact`.

Rules of the pass, in order, for a value at depth `d` (the log call's object is depth 0):

1. `d` > 8: `[DEPTH]`. Already on the current path: `[CIRCULAR]`.
2. String: `maskValue`. Number whose digits match a mobile number: `[MOBILE]`. Other primitives, `null`, `undefined` and `Date`: unchanged.
3. `Buffer`, `ArrayBuffer` or typed array: `[BINARY]`.
4. `Error`: `pino.stdSerializers.err`, then the pass on the result at the same depth.
5. Array: each element at `d + 1`.
6. Other object: own enumerable keys. A personal key gives `[REDACTED]`; any other key, its value at `d + 1`. A key whose read throws gives `[UNREADABLE]`.

`isPersonalKey(key)` splits the key into lower-case words at case changes and at `_`, `-`, `.` and
spaces. It is true if any word is on the existing list (`name`, `mobile`, `phone`, … `prescription`).
Compound list entries (`accessToken`, `refreshToken`) are covered by their word `token`.

## Audit, logging and monitoring

No audit event. The pass adds no log line of its own and never throws: any error inside it turns
that value into `[UNREADABLE]`, so a log call cannot crash a request.

## Threat model

| Threat                                                                                                       | Mitigation                                                               | Criterion |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | --------- |
| Information disclosure: a nested personal key (`req.query.phone`, `patient.contact.mobile`) written in clear | Key redaction at every depth, matched by word in any case                | LM-02.3   |
| Information disclosure: a mobile number inside a nested string, array element or number                      | Value masking at every depth                                             | LM-02.4   |
| Information disclosure: a number in an error message or stack (validation errors echo input)                 | Errors serialized and masked by the pass; leading `Error` message masked | LM-02.5   |
| Information disclosure: personal data in child bindings, interpolation or context                            | Pass applied at every entry point in the Summary table                   | LM-02.7   |
| Information disclosure or denial of service: deep or circular object bypasses or hangs the walk              | Depth cap and cycle detection, placeholders instead of values            | LM-02.6   |
| Repudiation: masking destroys trace correlation                                                              | Hex IDs and UUIDs kept by `maskValue`; non-personal keys unchanged       | LM-02.8   |
| Tampering: logging changes the caller's object                                                               | Pass builds new values only                                              | LM-02.8   |

## Rollout

No flag. It is a library change that ships with the next deploy of `main`; there is no
infrastructure, migration or cost. Rollback: revert the merge. Before merging, run the audit's
probe against the built package (SC-001) and record the output in `tasks.md`.

## Verification

| Criterion | Proof                                                                                                                          | Where                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| LM-02.3   | `LM-02.3 redacts personal keys at depth 2 and 3, in arrays and in any case`, `LM-02.3 redacts the audit probe req.query.phone` | `packages/logger/src/sanitize.test.ts`, `index.test.ts` |
| LM-02.4   | `LM-02.4 masks mobile numbers in nested strings, array elements and numbers`, `LM-02.4 masks the audit probe req.detail`       | `sanitize.test.ts`, `index.test.ts`                     |
| LM-02.5   | `LM-02.5 masks error message and stack and keeps the type`, for `{ err }` and `logger.error(err)`                              | `sanitize.test.ts`, `index.test.ts`                     |
| LM-02.6   | `LM-02.6 writes placeholders for depth, cycles, binary and unreadable fields`                                                  | `sanitize.test.ts`                                      |
| LM-02.7   | `LM-02.7 masks interpolation arguments, child bindings and context fields`                                                     | `index.test.ts`                                         |
| LM-02.8   | `LM-02.8 leaves the input unchanged and keeps IDs and counts`                                                                  | `sanitize.test.ts`                                      |
| SC-001    | Audit probe against `packages/logger/dist`                                                                                     | Recorded in `tasks.md` evidence                         |
| SC-002    | Table-driven corpus of at least 20 shapes in `sanitize.test.ts`                                                                | CI unit job                                             |
| SC-003    | `pnpm check` green; existing logger, API and job tests unchanged                                                               | CI                                                      |

## Complexity Tracking

None.
