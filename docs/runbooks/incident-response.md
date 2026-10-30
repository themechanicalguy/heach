# Incident response

- **Status:** Draft for owner review (30 October 2026), Step 10 "Prepare the launch". On-call rota and incident channel set by the owner on 30 October 2026 (below).
- **Applies to:** anyone who sees an alert (LM-07) or a report of the service misbehaving, and the on-call engineer.
- **Related:** [breach response](breach-response.md) when personal data may be exposed; [clinical emergency](clinical-emergency-during-visit.md) for a patient's safety; [backup and restore](backup-restore.md); [key rotation](key-rotation.md); [secret rotation](secret-rotation.md); deploys and rollback in [environments](../environments.md#how-a-deploy-works).

## On call and the incident channel

- **On call:** the account owner, alone, at all hours for SEV1 (owner decision, 30 October 2026).
  Review when a second person joins; contact details live outside this repository.
- **Alerts:** the API and the host publish to the SNS topic `heach-credit-reminders`
  (`ALERT_TOPIC_ARN` on the dev host): repeated authorisation failures, unusual record reads
  (AD-17), a failed restore check, payment or ledger reconciliation mismatches, and the credit
  and budget alerts. Its email subscription was confirmed on 30 October 2026, and delivery was
  proven by the restore-check alert of 25 October 2026.
- **Incident channel:** the email thread of the alert, until a chat channel is set up; every
  update in this runbook goes there.

## Severity

| Level | Examples | Response |
| --- | --- | --- |
| **SEV1** | Personal or health data exposed or suspected; sign-in, booking or payment down for everyone; payments taken without a booking | Start at once, any hour; owner informed within 30 minutes; breach runbook in parallel |
| **SEV2** | One journey broken (for example lab reports, vault uploads); payment or OTP success well below normal; reconciliation mismatch alert | Start within 1 hour in launch hours |
| **SEV3** | A degraded but working feature; one provider or patient affected | Next working day, as a ticket |

When unsure, pick the higher level; lowering it later is cheap.

## First 15 minutes

1. **Declare** the incident in the incident channel: level, what is seen, who leads. One person
   leads; everyone else reports to them.
2. **Stop the harm** before finding the cause:
   - A bad release: roll back to the previous tag ([environments](../environments.md#how-a-deploy-works)).
   - A broken feature: switch its flag off (`FEATURE_FLAGS`); `accounts` off hides every
     account feature and keeps the public pages up.
   - A leaked secret or key: rotate it ([secret rotation](secret-rotation.md), [key rotation](key-rotation.md)).
   - Abuse from one account: suspend it in the admin **Users** section (AD-03).
3. **Keep evidence.** Do not delete logs, rows or objects. Note times in IST and UTC.

## While it lasts

- Post an update in the channel every 30 minutes for SEV1, every hour for SEV2, even "no change".
- Never paste personal data, health data, tokens or codes into the channel, tickets or chat;
  refer to bookings and accounts by ID (SE-09).
- Payments: if money moved wrongly, finance checks the admin **Finance** totals and the
  gateway dashboard; refunds go through the admin, never by hand at the gateway (PY-02).
- If users are affected, support posts on the status page in Odia, English and Hindi.

## Closing

1. The lead confirms the harm has stopped and the service is normal on the dashboards.
2. Within 5 working days, write a blameless review: timeline, cause, what worked, actions with
   owners. Actions go in the [follow-up register](../follow-up-register.md).
3. If a test would have caught it, the fix adds that test.
