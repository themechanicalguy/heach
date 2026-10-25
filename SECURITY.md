# Security policy

HEACH will process health information about patients in Odisha. We treat every security report
as urgent.

## Reporting a vulnerability

- Email the maintainer (repository owner on GitHub) with "SECURITY" in the subject, or use
  GitHub's private vulnerability reporting if it is enabled for this repository.
- Include what you found, how to reproduce it, and what data or users it could affect.
- **Do not** open an issue or pull request, post details anywhere public, or access, change or
  keep data that is not yours.

We will acknowledge a report within 3 working days and keep you informed until it is resolved.

## If a secret was committed

Assume it is compromised, even if the commit was never pushed or was removed afterwards:

1. Revoke or rotate it with the issuing service immediately.
2. Tell the maintainer.
3. Only then clean up the history, if needed.

## Scope today

Development (guideline Steps 1 and 2) on one dev environment with synthetic data only: no
production environment and no real patient data exist yet. The breach
response plan (SO-09) is written before any real data is handled (guideline Step 6).
