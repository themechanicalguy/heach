# Specification Analysis Report: Transactional session rotation and replay handling

Consistency analysis of spec.md, plan.md, tasks.md and the design files against the constitution,
in the `/speckit-analyze` format, run 2026-10-22 by the author before requesting approval.
Findings marked _resolved_ were fixed in the artifacts in the same pull request.

| ID  | Category     | Severity            | Location(s)                                 | Summary                                                                                                                              | Recommendation                                                                                  |
| --- | ------------ | ------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| F1  | Coverage     | High (_resolved_)   | spec.md SE-07.18; research D-1              | A session-row lock alone serialises one token, but another device's refresh could still insert a session after a replay's revoke-all | Lock the user row (join `FOR UPDATE`); edge case and SE-07.20 added for sign-out of all devices |
| F2  | Dependency   | Medium              | plan.md Constraints; tasks.md Prerequisites | Needs spec 003's helper; if 003 changes its contract, this plan changes too                                                          | Implement strictly after 003; re-run this analysis if 003's contract changes                    |
| F3  | Scope        | Medium (_resolved_) | spec.md Out of scope                        | A lost response after commit still signs every device out                                                                            | Stated as accepted under strict replay detection; grace window stays an owner decision          |
| F4  | Consistency  | Low                 | auth.int-spec.ts SE-07.13 comment           | The existing test says the winner may survive; after this feature that is false                                                      | T017 updates the comment; SE-07.13 itself is unchanged                                          |
| F5  | Performance  | Low                 | plan.md Constraints                         | The user-row lock is held across a Redis round trip                                                                                  | Bounded by `lock_timeout` 5 s; SC-003 measures it                                               |
| F6  | Constitution | Info                | checklists/requirements.md                  | Checklist ticked by the author agent (PA-4 not in force)                                                                             | Owner may re-tick at review                                                                     |

**Coverage Summary Table:**

| Requirement key | Has task? | Task IDs   | Notes                |
| --------------- | --------- | ---------- | -------------------- |
| SE-07.14        | Yes       | T004, T009 | Unit and integration |
| SE-07.15        | Yes       | T005, T009 | Unit and integration |
| SE-07.16        | Yes       | T006, T010 | Unit and integration |
| SE-07.17        | Yes       | T007       | Integration          |
| SE-07.18        | Yes       | T011, T015 | Integration ×50      |
| SE-07.19        | Yes       | T012, T015 | Integration          |
| SE-07.20        | Yes       | T013, T016 | Integration ×50      |
| SC-001          | Yes       | T011       |                      |
| SC-002          | Yes       | T007       |                      |
| SC-003          | Yes       | T018       | Local timing         |

**Constitution Alignment Issues:** none. Principle I: docs only. Principle VIII: SE-07.1 to
SE-07.13 unchanged; no grace window.

**Metrics:** 7 criteria, 3 success criteria, 20 tasks, 100% criteria with a test task, 0 open
ambiguities, 0 open critical or high findings.

## Next actions

Ready for owner review. Implementation waits for this spec and plan to merge as Approved and for
spec 003 to be implemented.
