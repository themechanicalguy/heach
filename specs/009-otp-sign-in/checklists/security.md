# Security checklist: OTP sign-up and sign-in

**Purpose**: a reviewer's questions about the requirements' quality for authentication (not a
test plan). A human ticks the items; agents do not (constitution IX, proposed PA-4).

**Created**: 2026-10-28 | **Feature**: [spec.md](../spec.md), [plan.md](../plan.md)

## Authentication

- [ ] CHK001 Are code length, validity, attempts and resend cooldown all specified with numbers? [Completeness, SE-08.1 to SE-08.4]
- [ ] CHK002 Is it stated what happens to the previous code on resend? [Clarity, SE-08.4]
- [ ] CHK003 Are caps specified per number, device and address, and do they survive restarts? [Completeness, SE-08.5]
- [ ] CHK004 Is the response for known and unknown numbers specified as identical, including timing? [Measurability, AC-01.3]

## Authorisation

- [ ] CHK005 Is every signed-in route limited to the caller's own account, with no user ID parameter? [Coverage, AC-01.6, SE-02.4]
- [ ] CHK006 Is it explicit that no role comes from browser input, with a test for each field name? [Coverage, AC-01.5]
- [ ] CHK007 Is the re-verification grant bound to session, purpose and time, and single use? [Clarity, AC-05.3]

## Data exposure

- [ ] CHK008 Are the code and the number excluded from logs, URLs, errors and the database in clear? [Coverage, SE-08.6, EN-09.3]
- [ ] CHK009 Is the SMS text limited to the code, app name and validity? [Clarity, NT-01.1]
- [ ] CHK010 Is spec 008 a stated prerequisite for this code? [Dependency, plan Constitution Check]

## Test scaffolding

- [ ] CHK011 Is the outbox gate the same as SE-07.23's, and is the test sign-in removal specified? [Consistency, SE-07.25]
- [ ] CHK012 Is the flag's default per environment stated, off where real users could reach it? [Completeness, plan Rollout]

## Redirects and sessions

- [ ] CHK013 Are hostile return paths listed (other origin, `//`, `\`, encoded scheme)? [Coverage, SE-07.24]
- [ ] CHK014 Is the behaviour on an ended session specified, including no-store? [Clarity, AC-05.2]
