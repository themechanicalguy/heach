# Tasks: Security review fixes (2026-10-24)

- [x] T001 Finding 1: address and user throttlers (`apps/api/src/security/user-throttler.guard.ts`, `security.module.ts`, `RATE_LIMIT_PER_ADDRESS_PER_MINUTE`), health exempt from both, RUM caps both; `scripts/rate-limit-check.sh` sends 250 requests (SO-08.12)
- [x] T002 Finding 2: `TestLoginGate` and `testLoginPermitted` (SE-07.23); Caddy public entry 404 and header strip, loopback entry on 9443 adds the key; `TEST_LOGIN_KEY` parameter, API secret in dev, Caddy env; CI deploy bundle checks and E2E through 9443
- [x] T003 Finding 3: pnpm overrides for multer, Lighthouse (drops extract-zip), tmp, uuid, basic-ftp; refreshed body-parser, undici, zod; CI audits all dependencies (SO-03.2); scanner fixture uses a dev dependency
- [x] T004 Finding 4: family sets for access tokens; device sign-out revokes the family under the user lock (SE-07.21)
- [x] T005 Finding 5 (server): a family with no live session is a plain 401 (SE-07.22); client already shares one refresh (spec 001)
- [x] T006 Finding 6: verified already fixed by spec 003 (`audit-transaction.int-spec.ts`, `notes.repository.spec.ts`)
- [x] T007 Finding 7: API IAM role with exact parameter ARNs, narrower host role, IMDS hop limit 1, `api-credentials.sh` and timer, privileged passwords only to one-off containers; static checks (EN-12.4)
- [x] T008 Docs: specs index, implementation status, cloud setup and environments (loopback entry), spec 002 and 004 notes, security review remediation section
- [x] T009 Owner: approve this spec; apply the infra plan; re-run Deploy dev; confirm live (IAM simulation for the API role, public test sign-in 404). Approved, applied and redeployed by the owner on 24 October 2026; live checks run the same day ([live verification](../../../reviews/2026-10-24-security-review.md#live-verification-after-the-apply-2026-10-24))

## Evidence

Recorded in the [security review's remediation section](../../../reviews/2026-10-24-security-review.md#remediation-2026-10-24).
