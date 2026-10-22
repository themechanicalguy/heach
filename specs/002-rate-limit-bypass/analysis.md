# Specification Analysis Report: Rate-limit bypass with fake bearer tokens

Consistency analysis of spec.md, plan.md, tasks.md and the design files against the constitution,
in the `/speckit-analyze` format, run 2026-10-21 before requesting approval and re-run 2026-10-22
against `main` at 7fd1ba7 (F9 to F11). Findings marked
_resolved_ were fixed in the artifacts in the same pull request.

| ID  | Category                | Severity            | Location(s)                        | Summary                                                                                                                                                          | Recommendation                                                                                                                                            |
| --- | ----------------------- | ------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Inconsistency with code | Medium (_resolved_) | contracts/rate-limit.md            | The first draft promised `X-RateLimit-*` headers; a probe against the running API showed only `Retry-After` on 429                                               | Contract now promises `Retry-After` on 429 only                                                                                                           |
| F2  | Coverage                | Medium (_resolved_) | spec.md SC-001; tasks.md           | SC-001 (10 × N fake-token requests, at least 9 × N refused) had no task                                                                                          | Added to T004                                                                                                                                             |
| F3  | Test design             | Medium (_resolved_) | tasks.md T002, T009, T010          | Test sign-ins go through the limited `test-login` route from the same address, so setup would use up the allowance under test and make SO-08.6 and SO-08.7 flaky | T002 helpers sign in from a separate `X-Forwarded-For` address                                                                                            |
| F4  | Underspecification      | Low (_resolved_)    | plan.md threat model               | Every request with a well-formed bearer token now costs one Redis read before the limit decision, including refused ones, so a flood becomes Redis reads         | Accepted and recorded: bounded by Caddy's 300 a minute per address; one `GET` per request                                                                 |
| F5  | Underspecification      | Low (_resolved_)    | spec.md                            | Choices with user impact (user-only key, in-memory counters, fail-to-address, one threshold, trusted hop) were implicit                                          | Recorded in Clarifications and research D-1 to D-5 for owner confirmation                                                                                 |
| F6  | Coverage                | Low                 | SO-08.10                           | The deployed proxy's handling of client forwarding headers is proven by the deploy-bundle check, not by a unit test of Caddy                                     | Accept; the check runs on every pull request                                                                                                              |
| F7  | Constitution            | Info                | checklists/requirements.md         | The quality checklist is ticked by the author agent, as in spec 001, and the file says so                                                                        | Owner may re-tick at review                                                                                                                               |
| F8  | Terminology             | Info                | spec.md, research.md               | The review is cited by path but is not committed                                                                                                                 | Owner decides; the repository is now public, so committing it would publish findings that are not fixed yet. Keep citing it as uncommitted until they are |
| F9  | Underspecification      | Medium (_resolved_) | spec.md SO-08.6, SO-08.7; contract | The throttler keys counters per route (`generateKey`: class, handler, name), so "one allowance" per user is one per route; the spec and contract did not say so  | Stated in scope, criteria, edge cases, contract and research D-6 (owner to confirm)                                                                       |
| F10 | Underspecification      | Low (_resolved_)    | plan.md threat model               | A stalled (not failed) session store delays the tracker; it was not covered                                                                                      | Recorded as D-7 and a threat row: bounded by the Redis client; counted before served                                                                      |
| F11 | Test design             | Low (_resolved_)    | tasks.md T015                      | Counting 429s through Caddy cannot tell the API's 429 from Caddy's                                                                                               | T015 asserts the API's JSON error body                                                                                                                    |

**Coverage Summary Table:**

| Requirement key | Has task? | Task IDs         | Notes                               |
| --------------- | --------- | ---------------- | ----------------------------------- |
| SO-08.4         | Yes       | T004, T007, T008 | Integration, regression proof       |
| SO-08.5         | Yes       | T005, T008       | Integration                         |
| SO-08.6         | Yes       | T009, T008, T011 | Integration                         |
| SO-08.7         | Yes       | T010, T008, T011 | Integration                         |
| SO-08.8         | Yes       | T006, T007, T008 | Unit and integration                |
| SO-08.9         | Yes       | T001, T012       | Integration (1-second window)       |
| SO-08.10        | Yes       | T013, T015, T016 | Integration and deploy-bundle check |
| SO-08.11        | Yes       | T014, T017       | Unit                                |
| SC-001          | Yes       | T004             | Integration                         |
| SC-002          | Yes       | T006             | Integration                         |
| SC-003          | Yes       | T010             | Integration                         |

**Constitution Alignment Issues:** none. Principle I: this pull request contains no application
code. Principle VI: no new dependency; Redis-backed counters are a recorded alternative, not
adopted. Principle VIII: Step 2 SO-08.1 to SO-08.3 unchanged.

**Unmapped Tasks:** T002, T003 (scaffolding), T018 to T021 (verification and status).

**Metrics:**

- Total requirements (criteria): 8 (SO-08.4 to SO-08.11), plus 3 success criteria
- Total tasks: 21
- Coverage: 100% of criteria have at least one test task
- Ambiguity count: 0; duplication count: 0; critical issues: 0

## Next actions

No critical or high findings remain. Ready for owner review (gate G1 and G2).
