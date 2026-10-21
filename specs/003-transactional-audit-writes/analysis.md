# Specification Analysis Report: Transactional domain writes and their audit entries

Consistency analysis of spec.md, plan.md, tasks.md and the design files against the constitution,
in the `/speckit-analyze` format, run 2026-10-22 against `main` at 7fd1ba7 before requesting
approval. Findings marked _resolved_ were fixed in the artifacts in the same pull request.

| ID  | Category           | Severity            | Location(s)                       | Summary                                                                                                                                                                                                        | Recommendation                                                                                                                                    |
| --- | ------------------ | ------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Design risk        | Medium (_resolved_) | plan.md Constraints, threat model | Wrapping the insert and `audit.append` in one transaction holds the audit log's global advisory lock until `COMMIT`; a KMS call or extra statement inside would hold it longer for every audited request (P-2) | Encrypt before `BEGIN`; append last (D-4); unit test asserts the order (T009)                                                                     |
| F2  | Test design        | Medium (_resolved_) | tasks.md T005                     | `createApp` has no provider override, so the audit failure cannot be injected by swapping the module                                                                                                           | Spy on the singleton `AuditService` and send a failing `audit.append` through the given client: a real database error inside the real transaction |
| F3  | Coverage           | Low (_resolved_)    | spec.md SE-05.6                   | An insert failure is hard to cause from outside in an integration test                                                                                                                                         | Integration proof uses an encryption failure; the insert failure is proven by a unit test (T007)                                                  |
| F4  | Coverage           | Info                | SE-05.8                           | Already holds today (audit runs before decryption); the test guards the reordering in T013 against regressions                                                                                                 | Accept; recorded in T012                                                                                                                          |
| F5  | Underspecification | Low (_resolved_)    | research.md                       | The rollback-failure path of the existing data-key transaction returns a connection in an unknown state                                                                                                        | D-5 and D-6: the helper destroys it; the data-key store reuses the helper                                                                         |
| F6  | Scope              | Info                | spec.md Out of scope              | The re-encryption job reads and writes Restricted data with no audit entry, also an SE-05 gap                                                                                                                  | Left to backlog item 4 (its spec decides how a system job is audited); stated on the status page                                                  |
| F7  | Constitution       | Info                | checklists/requirements.md        | The quality checklist is ticked by the author agent, as in specs 001 and 002, and says so                                                                                                                      | Owner may re-tick at review                                                                                                                       |
| F8  | Terminology        | Info                | spec.md, research.md              | The 18 October review is cited by path but not committed                                                                                                                                                       | Same as spec 002 F8: owner decides                                                                                                                |

**Coverage Summary Table:**

| Requirement key | Has task? | Task IDs         | Notes                                          |
| --------------- | --------- | ---------------- | ---------------------------------------------- |
| SE-05.5         | Yes       | T006, T008, T009 | Integration, regression proof, order unit test |
| SE-05.6         | Yes       | T007, T008, T009 | Integration (encryption) and unit (insert)     |
| SE-05.7         | Yes       | T010, T012, T013 | Integration, regression proof                  |
| SE-05.8         | Yes       | T011, T013       | Integration (guard)                            |
| SE-05.9         | Yes       | T001, T002, T003 | Unit                                           |
| SE-05.10        | Yes       | T014             | Integration                                    |
| SC-001          | Yes       | T006             | 50 runs                                        |
| SC-002          | Yes       | T007             | 50 saves                                       |
| SC-003          | Yes       | T014             | 30 failures                                    |

**Constitution Alignment Issues:** none. Principle I: this pull request contains no application
code. Principle VI: no new dependency; ambient transactions rejected (D-1). Principle VIII: Step
2 SE-05.1 to SE-05.4 unchanged.

**Unmapped Tasks:** T004 (reuse), T005 (scaffolding), T015 to T019 (verification and status).

**Metrics:**

- Total requirements (criteria): 6 (SE-05.5 to SE-05.10), plus 3 success criteria
- Total tasks: 19
- Coverage: 100% of criteria have at least one test task
- Ambiguity count: 0; duplication count: 0; critical issues: 0

## Next actions

No critical or high findings remain. Ready for owner review (gate G1 and G2).
