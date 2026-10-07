# 0004. Stay on GitHub Free with a private repository and no branch protection

- **Status:** Accepted
- **Date:** 2026-10-07
- **Requirements:** SO-03

## Context

GitHub returned HTTP 403 when enabling branch protection: it needs GitHub Pro or a public
repository. Making the repository public would publish the security design of a healthcare
application.

## Decision

Keep the repository private on GitHub Free and use free tooling only, until the project has
traction. Protect `main` by process: every change through a pull request, merged only when all
CI jobs pass; the local pre-push hook blocks pushes to `main`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Free, process plus local hook (chosen) | No cost | Not enforced on GitHub; can be bypassed |
| GitHub Pro (about US$4 a month) | Real enforcement | Cost |
| Public repository | Free enforcement | Exposes security design |

## Consequences

- Revisit when a second developer joins or before real patient data is handled (Stage A pilot).
- Paid features (branch protection, GitHub secret scanning) are out of scope until then.
