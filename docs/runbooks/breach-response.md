# Personal data breach response (SO-09)

- **Status:** Draft for owner and lawyer review (30 October 2026). The notification duties and timings below must be confirmed by the lawyer against the Digital Personal Data Protection Act, 2023, its Rules and the CERT-In directions before go-live. A named breach owner and a rehearsal are required by SO-09.
- **Breach owner:** to be named by the operator (follow-up register).
- **Applies to:** any confirmed or suspected unauthorised access to, disclosure of, change to or loss of personal data, including health data in the vault, visit notes and lab reports.

## Within the first hour

1. Run [incident response](incident-response.md) as **SEV1** and tell the breach owner.
2. **Contain:** revoke the access path (suspend accounts, revoke vault shares and links, rotate
   keys or secrets, switch a feature flag off). Do not delete evidence.
3. **Scope** using the audit log and access histories, never by opening record content:
   which data classes (Restricted, Confidential), which accounts, which period. Use
   break-glass only if the scope cannot be found otherwise, and record why (SE-03).

## Notifications (confirm timings with the lawyer)

| Who | What | When (to confirm) |
| --- | --- | --- |
| CERT-In | Cyber security incident report | Within 6 hours of noticing it |
| Data Protection Board of India | Intimation of the breach, then a detailed report: what happened, data and people affected, measures taken, steps for users | Intimation without delay; detailed report within 72 hours |
| Each affected person | In their language (Odia, English or Hindi): what happened, what data, what we did, what they should do, whom to contact | Without delay |
| Processors and partners | Payment, SMS, identity and cloud providers when their systems are involved | As their agreements require |

Notifications to people go by SMS and in-app notification without any health detail in the
text (SE-09); the detail is behind sign-in.

## Afterwards

- Keep the record of the breach, the facts, the effects and the actions taken, for the
  period the lawyer advises.
- Blameless review as in incident response; fixes and tests in the follow-up register.
- Rehearse this runbook at least once before go-live and then every six months (SO-09).
