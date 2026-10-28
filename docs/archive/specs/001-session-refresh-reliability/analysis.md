# Specification Analysis Report: Session-refresh reliability

Consistency analysis of spec.md, plan.md, tasks.md and the design files against the constitution,
in the `/speckit-analyze` format, run 2026-10-21 before requesting approval. Findings marked
_resolved_ were fixed in the artifacts in the same pull request.

| ID  | Category                | Severity            | Location(s)                                  | Summary                                                                                                                                                                                                                 | Recommendation                                                                                    |
| --- | ----------------------- | ------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| F1  | Inconsistency with code | High (_resolved_)   | spec.md SE-07.13; `session.service.ts:40-46` | Under a truly concurrent replay the loser revokes the user's sessions before the winner inserts its new session, so the winner's session and access token can survive. The first draft claimed every session is revoked | SE-07.13 now states only what is guaranteed; residual in plan threat model; fix is backlog item 3 |
| F2  | Inconsistency with code | Medium (_resolved_) | spec.md SE-07.9; `auth.controller.ts:41-46`  | The server clears the refresh cookie on every refresh error, including 5xx, so "the next call refreshes normally" cannot hold after a server error                                                                      | SE-07.9 narrowed to the client guarantee; server part added to backlog item 3                     |
| F3  | Underspecification      | Low (_resolved_)    | spec.md                                      | Open behaviour choices (grace window, offline start, cross-tab timing) were implicit                                                                                                                                    | Recorded in Clarifications and Assumptions for owner confirmation                                 |
| F4  | Coverage                | Low                 | SE-07.7, SE-07.12                            | Cross-tab behaviour is proven in Chromium only (the E2E projects); Safari and Firefox rely on the same standard APIs untested                                                                                           | Accept for now; manual check optional (quickstart)                                                |
| F5  | Constitution            | Info                | checklists/requirements.md                   | The quality checklist is ticked by the author agent. PA-4 (humans tick checklists) is only a proposal, so this is allowed, and the file says so                                                                         | Owner may re-tick at review                                                                       |
| F6  | Terminology             | Info                | spec.md, review                              | The review is cited by path but is not committed                                                                                                                                                                        | Commit the review or keep citing it as uncommitted                                                |

**Coverage Summary Table:**

| Requirement key | Has task? | Task IDs               | Notes                      |
| --------------- | --------- | ---------------------- | -------------------------- |
| SE-07.5         | Yes       | T003, T005, T008       | Unit and E2E               |
| SE-07.6         | Yes       | T004, T006             | Unit                       |
| SE-07.7         | Yes       | T007, T008, T009, T010 | Unit (lock double) and E2E |
| SE-07.8         | Yes       | T011, T017, T018       | Unit                       |
| SE-07.9         | Yes       | T012, T018             | Unit                       |
| SE-07.10        | Yes       | T013, T014, T017       | Unit and integration       |
| SE-07.11        | Yes       | T015, T002             | Unit                       |
| SE-07.12        | Yes       | T016, T017             | E2E                        |
| SE-07.13        | Yes       | T019, T020             | Integration                |
| SC-001          | Yes       | T022                   | E2E repeat 50              |
| SC-002          | Yes       | T019                   | Integration                |
| SC-003          | Yes       | T016                   | E2E                        |

**Constitution Alignment Issues:** none. Principle I is respected: this pull request contains no
application code. Principle VIII: Step 2 criteria SE-07.1 to SE-07.4 unchanged.

**Unmapped Tasks:** T001, T002 (foundation for all criteria), T020 to T024 (verification and status).

**Metrics:**

- Total requirements (criteria): 9 (SE-07.5 to SE-07.13), plus 3 success criteria
- Total tasks: 24
- Coverage: 100% of criteria have at least one test task
- Ambiguity count: 0 open; Duplication count: 0 (CI `check-specs` confirms unique IDs)
- Critical issues count: 0 open

## Next actions

No open Critical or High findings. Ready for owner review and approval. Implementation (`/speckit-implement`,
tasks T001 onward) waits until spec.md and plan.md are merged as Approved.
