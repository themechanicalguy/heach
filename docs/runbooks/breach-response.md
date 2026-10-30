# Personal data breach response (SO-09)

- **Status:** Draft for owner and lawyer review (30 October 2026). The notification duties and timings below must be confirmed by the lawyer against the Digital Personal Data Protection Act, 2023, its Rules and the CERT-In directions before go-live. A named breach owner and a rehearsal are required by SO-09.
- **Breach owner:** the account owner (operator), named on 30 October 2026. Contact details live with the on-call rota, not in this repository.
- **Applies to:** any confirmed or suspected unauthorised access to, disclosure of, change to or loss of personal data, including health data in the vault, visit notes and lab reports.

## Within the first hour

1. Run [incident response](incident-response.md) as **SEV1** and tell the breach owner.
2. **Contain:** revoke the access path. Do not delete evidence.
   - One person's records exposed: in the admin, **Users → Suspend** the account (a fresh code;
     a suspended owner's outside links stop at once), then revoke every booking share and outside
     link of the account: `POST /admin/v1/vault/accounts/<accountId>/revoke-shares` (super admin
     or support, fresh code, audited as `vault.shares_revoked`; it answers how many were revoked).
   - A provider or staff account misused: suspend it (AD-03); every session ends.
   - A leaked key or secret: [key rotation](key-rotation.md), [secret rotation](secret-rotation.md).
   - Wider exposure: switch the `accounts` flag off (every account feature stops; public pages stay).
3. **Scope** using the audit log and access histories, never by opening record content:
   which data classes (Restricted, Confidential), which accounts, which period. Use
   break-glass only if the scope cannot be found otherwise, and record why (SE-03). Reads of one
   account's records, as the database superuser (counts and times only):

   ```sql
   SELECT a.accessor_role, a.external_share_id IS NOT NULL AS via_link, count(*),
          min(a.created_at), max(a.created_at)
     FROM app.record_access a JOIN app.vault_record r ON r.id = a.record_id
    WHERE r.owner_account_id = '<accountId>' GROUP BY 1, 2;
   ```

   The security console (AD-17) shows today's unusual readers and authorisation failures.

## Notifications (confirm timings with the lawyer)

| Who | What | When (to confirm) |
| --- | --- | --- |
| CERT-In | Cyber security incident report | Within 6 hours of noticing it |
| Data Protection Board of India | Intimation of the breach, then a detailed report: what happened, data and people affected, measures taken, steps for users | Intimation without delay; detailed report within 72 hours |
| Each affected person | In their language (Odia, English or Hindi): what happened, what data, what we did, what they should do, whom to contact | Without delay |
| Processors and partners | Payment, SMS, identity and cloud providers when their systems are involved | As their agreements require |

Notifications to people go by SMS and in-app notification without any health detail in the
text (SE-09); the detail is behind sign-in. The `security_notice` template exists in Odia,
English and Hindi for this; its wording can be adjusted in the admin **Content** section
(AD-09), and the real SMS provider must have it registered before use.

## Afterwards

- Keep the record of the breach, the facts, the effects and the actions taken, for the
  period the lawyer advises.
- Blameless review as in incident response; fixes and tests in the follow-up register.
- Rehearse this runbook at least once before go-live and then every six months (SO-09).

## Rehearsals

| Date | Scenario | What was checked | Findings and actions | Who |
| --- | --- | --- | --- | --- |
| 2026-10-30 | Tabletop on dev, synthetic: a patient's outside-doctor link (MV-09) posted publicly; the unusual-read alert fires | Detection path (alert publisher proven by the restore-check alert of 25 October); containment levers; scoping without opening content; notification text | 1. Suspending the owner did **not** stop their outside links: fixed, links of a suspended owner now answer 404. 2. Operations could not revoke one account's shares and links: added `revoke-shares` (fresh code, audited). 3. No ready notice text for affected people: added `security_notice` in three languages. All three with tests (`vault.int-spec.ts`, SO-09). Still open: lawyer confirmation of timings (FU-38), the on-call rota and incident channel (FU-37) | Owner with Claude Code |
