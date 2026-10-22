# Step 2 status assessment, 22 October 2026

Point-in-time check of what Step 2 has actually delivered, made before the remaining corrective
work starts. Earlier reports were treated as leads and re-checked against `main`, GitHub and the
local copies; anything that could not be re-checked today is marked so. This page does not change
any status by itself: [implementation status](implementation-status.md) is the record, and it was
updated in the same pull request. **Step 2 is not complete.**

## Levels used

| Level | Meaning |
| --- | --- |
| Implemented | Code on `main` |
| CI-validated | Its tests ran green in CI on `main` |
| Deployed | Running on the dev host at the deployed tag |
| Operationally accepted | Owner-confirmed outcome outside code (email arrives, reviewer signed off, restore drill on schedule) |

## Repository and delivery (verified 22 October)

| Item | Finding | Evidence |
| --- | --- | --- |
| `main` | `7c8c1c9` (spec 002, #64), merged 22 October 10:38 UTC | `git log origin/main` |
| Open pull requests | None | `gh pr list` |
| CI on `main` | Green, all 7 jobs (Checks, Static analysis and scanner fixtures, Secret scan, API image, Deploy bundle, E2E smoke, Infra) | [run 39764661521](https://github.com/themechanicalguy/heach/actions/runs/39764661521) |
| Deploy dev | Green for `7c8c1c936e82`: build, image scan gate, deploy over SSM, smoke test passed on 15.252.65.98; rollback target `985ec4566175` present in the registry (the 18 October gap "Previous tag: none" did not recur) | [run 39765865553](https://github.com/themechanicalguy/heach/actions/runs/39765865553) |
| Credit watch | Scheduled runs green on 18, 19, 20, 21 and 22 October (the "three scheduled daily runs" item is met) | `gh run list --workflow "Credit watch"` |
| Branch protection | Not enabled: `GET …/branches/main/protection` → 404 `Branch not protected`; repository public | Settings proposed in [environments](environments.md#branch-protection-on-main); owner decision |
| Spec 001 (SE-07.5 to SE-07.13) | Implemented, CI-validated, deployed; Done | #56, #57 |
| Spec 002 (SO-08.4 to SO-08.11) | Implemented, CI-validated, deployed in `7c8c1c9`; Done awaits owner review of the evidence | #64, run above |
| Spec 003 (SE-05.5 to SE-05.10) | **Draft**, not approved; no code | [spec](../specs/003-transactional-audit-writes/spec.md), #61 |

## Defects confirmed in code on `main` 7c8c1c9

Confirmed by reading the code paths; execution repros were not run in this session (local
services were not started). Each is covered by a Draft spec; none is fixed.

| Defect | Root cause | Spec |
| --- | --- | --- |
| A note can be stored with no audit entry; a failed read is audited as a read | `notes.repository.ts:39-43`: insert and `audit.record` are two pool statements; `:54-59` and `:67-68` audit before decrypting | [003](../specs/003-transactional-audit-writes/spec.md) |
| A transient fault during refresh signs the user out | `session.service.ts:40-46`: revoke, insert and token issue are separate steps; `auth.controller.ts:43-45` clears the cookie on every error, including 5xx | [004](../specs/004-transactional-session-rotation/spec.md) |
| A concurrent replay leaves the winner's session alive | The loser's `signOutEverywhere` runs before the winner inserts its session and issues its access token; the guard trusts Redis tokens without reading the session row; `auth.int-spec.ts` SE-07.13 does not assert the winner | [004](../specs/004-transactional-session-rotation/spec.md) |
| The re-encryption job can loop forever, miscounts and is unaudited | `reencrypt.ts:25-42`: `keyVersion <> current` with no cursor reselects un-updated rows and rows on newer keys; `done += 1` ignores `rowCount`; no audit entries | [005](../specs/005-bounded-reencryption/spec.md) |

## Rate-limit counters

One API container (`deploy/dev/compose.yml`, service `api`, no replicas) running one Node process
(`CMD ["node", …, "dist/main.js"]`, no cluster). In-memory counters are therefore exact today;
shared counters (backlog item 8) are required only before a second process or host. Not needed now.

## Backups and recovery

| Item | Finding | Level |
| --- | --- | --- |
| Nightly dump | `heach-backup.timer` at 21:00 UTC, installed by `deploy.sh`; two dumps proven on 18 October | Implemented, deployed; **not re-checked today** (AWS session expired) |
| Restore evidence | Two records, both 18 October ([runbook](runbooks/backup-restore.md#restore-records)) | One-off proof |
| Recurring restore verification | **None scheduled.** No timer, workflow or calendar entry runs `restore-check.sh` | Gap (backlog item 5) |
| Off-account copy | Only `2026-10-18T1018Z` and `…1019Z` in `~/HEACH-backups`; the weekly pull is a manual owner step with nothing reminding or checking it | Gap: depends on the owner |
| Off-account recovery prerequisites | (1) The Keychain passphrase must also be in the owner's password manager: unconfirmed. (2) **Restricted fields in the copy are wrapped by the dev KMS keys** (AWS-origin, not exportable). If the AWS account is lost, the copy restores the schema and non-Restricted data, but no health value can be decrypted | Gap, new finding; needs an owner decision (ADR) before real data |

## Alerts: published versus delivered

| Item | Finding |
| --- | --- |
| Publication | Proven 18 October: SO-08.3 and LM-07.1 raised SNS `NumberOfMessagesPublished` on `heach-credit-reminders` ([log](step-2-progress.md)) |
| Subscription state | **Contradictory records.** `docs/step-1-review.md` (commit f5f9796, 18 October 01:38 IST) says the owner confirmed it; `docs/step-2-progress.md` (be808e5, 18 October 16:18 IST) says PendingConfirmation. Not re-checked today: the AWS CLI session had expired |
| Delivery | **Never confirmed.** No record of an alert email arriving. Only one address is subscribed |

To settle it: `aws sns list-subscriptions-by-topic --topic-arn arn:aws:sns:ap-south-1:667291759252:heach-credit-reminders --profile saurav-heach-admin`
(a real ARN in `SubscriptionArn` means confirmed), then the owner confirms a labelled test email
arrived.

## Owner-side items

| Item | Status 22 October |
| --- | --- |
| Lawyer review (D6, Step 2 exit) | Not engaged. Pack ready ([review pack](reviews/lawyer-review-step-2.md)); issue #23 open, no activity since 17 October |
| Native Odia review (I18N-07) | Not engaged. Sheet ready ([review sheet](reviews/odia-review-step-2.md)) |
| Partner onboarding | Issues #19 to #25 all open, no comments since 17 October |
| Branch protection | Not enabled (above) |

## Corrective work, in dependency order

| # | Feature | Criteria | Depends on | Approval |
| --- | --- | --- | --- | --- |
| 1 | [003 Transactional audit writes](../specs/003-transactional-audit-writes/spec.md): `withTransaction`, atomic note and audit, reads audited after decryption | SE-05.5 to SE-05.10 | — | Draft; needs owner approval (G1, G2) |
| 2 | [004 Transactional session rotation](../specs/004-transactional-session-rotation/spec.md): one transaction per rotation, per-user lock so a replay revokes the winner, cookie cleared only on 401; strict replay, no grace window | SE-07.14 to SE-07.20 | 003 implemented | Draft; needs owner approval |
| 3 | [005 Bounded re-encryption](../specs/005-bounded-reencryption/spec.md): keyset walk, numeric `<` target, real counts, per-row audit as the system job | EN-05.4 to EN-05.9 | 003 implemented (independent of 004) | Draft; needs owner approval |

Engineering that is already authorised once a spec is approved (owner approvals of 18 October:
merge green PRs): implementing each approved spec on a `fix/NNN-…` branch with its tests, status
update and PR.

Owner actions (agents cannot do these):

1. Approve or change specs 003, 004 and 005 (merge with Status Approved).
2. Run `aws login` and settle the SNS subscription; confirm a labelled test email arrives.
3. Store the backup passphrase in the password manager; run the weekly `scripts/backup-pull.sh`.
4. Decide how Restricted data in the off-account copy is recoverable without the AWS account
   (for example an escrowed or externally held key), recorded in an ADR before real data.
5. Decide whether a recurring restore check is scheduled now or at the pilot (backlog item 5).
6. Engage the lawyer (D6) and a native Odia reviewer (I18N-07); progress partner issues #19 to #25.
7. Decide on branch protection ([environments](environments.md#branch-protection-on-main)).
8. Optional: remove the unused `ssm:GetParametersByPath` from the host policy.
