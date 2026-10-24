# Security review — 2026-10-24

> **Remediation status (24 October 2026):** all seven findings are fixed in code on branch
> `fix/security-review-2026-10-24` ([spec 007](../../specs/007-security-review-fixes/spec.md),
> Draft), verified locally, **not yet merged, applied or deployed**. Finding 7's IAM separation takes
> effect only after the owner applies the infrastructure plan and re-runs Deploy dev. See
> [Remediation](#remediation-2026-10-24) at the end. The original review follows unchanged.

**Verdict: the codebase is not fully secure and is not ready to handle real patient data.**

This review covers the current workspace: API authentication and authorization, notes, SQL and
audit logging, encryption, browser sessions and caching, dependency lockfile, containers,
deployment configuration, IAM definitions, and CI security gates. It is a source review with
targeted reproductions and a live dependency audit, not a penetration test of the deployed AWS
environment. No application or infrastructure fixes were made.

## Findings

### 1. High: unauthenticated clients can bypass the rate limiter

Evidence: `apps/api/src/security/user-throttler.guard.ts:10`,
`apps/api/src/app.module.ts:55`, and `apps/api/src/auth/auth.guard.ts:18`.

The throttler chooses a bucket from any syntactically valid bearer header before authentication.
An attacker can change an invalid token on every request, including requests to public login,
refresh and telemetry endpoints. Valid tokens are counted separately rather than by user, too.

Reproduction: executed the tracker method extracted from the current source with the actual
bearer regex and SHA-256 hashing. One IP and 1,000 different invalid tokens produced 1,000
distinct buckets. This proves the bucket selection defect; it was not a network load test.

Fix: enforce an IP limit independently of supplied credentials; derive additional user limits
only from resolved identities. Use shared storage if running multiple API processes. Add a
regression test that varies invalid bearer tokens.

### 2. High exposure in dev: public passwordless identity impersonation

Evidence: `apps/api/src/auth/auth.controller.ts:21`,
`apps/api/src/auth/session.service.ts:24`, `apps/api/src/auth/test-identity.adapter.ts:4`,
`apps/api/migrations/0002_sessions_and_sample_notes.sql:16`, and `deploy/dev/Caddyfile`.

The public test-login route accepts only a user UUID. The migration supplies fixed patient,
provider and admin UUIDs. The dev configuration permits this adapter and routes public
`/api/*` traffic to the API. Anyone reaching that deployment can obtain tokens for these
identities and access their permitted API operations, including patient sample notes.

This is intentional scaffolding restricted to synthetic data, not evidence that a production
login was bypassed. Staging and production currently refuse to start through this auth module.
The admin role does not bypass the separate network restriction on the admin website.

Fix: restrict dev access to trusted users/networks and remove the adapter before introducing
real users or data. Replace it with verified identity authentication.

### 3. Critical dependency advisory: vulnerable Storybook development server

Evidence: `packages/ui/package.json:42` pins Storybook 10.6.1 and exposes a `storybook dev`
command. The live audit reports GHSA-f2ph-cmg5-wxc8 (critical) and GHSA-px85-f4q5-jh77 (high).

The maintainer describes malicious websites causing unauthorized project-file changes while
an affected Storybook dev server is running; additional conditions can lead to execution with
developer privileges. Built static Storybooks are outside the first advisory's impact.

Fix: upgrade the related Storybook packages together to at least 10.6.2 and recheck the audit
before running the development server. This is a developer-workstation threat, not a demonstrated
production API exploit.

Sources: [maintainer advisory](https://github.com/storybookjs/storybook/security/advisories/GHSA-f2ph-cmg5-wxc8),
[second advisory](https://github.com/advisories/GHSA-px85-f4q5-jh77).

### 4. Medium: logout can leave earlier access tokens active

Evidence: `apps/api/src/auth/session.service.ts:44`, `:51`, and
`apps/api/src/auth/access-token.store.ts:28`.

Refreshing creates a new session and access token without removing the earlier access token.
Single-device logout revokes only the presented token and its session. The guard resolves
tokens from Redis without checking database session revocation. Consequently, an access token
issued before refresh can remain usable after the device logs out, until its 15-minute TTL ends.

Reproduction: executed the current logout method with a simulated token store containing
pre-refresh and post-refresh tokens. Logging out the latter left the former unrevoked. The
surrounding issue/resolve behavior was verified in source; no real account was accessed.

Fix: track access tokens by a stable device/session family and revoke the entire device family
on logout, or enforce a revocation generation during token resolution. Test login → refresh →
logout → reuse the earlier token.

### 5. Medium: concurrent refresh requests can log out every device

Evidence: `apps/web/src/lib/api.ts:37`, `:48`, and
`apps/api/src/auth/session.service.ts:40`.

Each concurrent API response with status 401 independently calls refresh. Both requests can
carry the same cookie. After one rotates it, the other triggers replay detection and revokes
every session of that user. This is an availability defect in normal client operation.

Reproduction: loaded the current browser API module with TypeScript types removed and its
parameter-property syntax desugared, using a mocked fetch. Two concurrent 401s produced two
independent refresh requests. The server's revoke-all response is established by source review.

Fix: share one in-flight refresh promise within the client; coordinate refreshes across tabs as
needed. Preserve replay protection and test concurrent requests.

### 6. Medium: note creation and audit entry are not atomic

Evidence: `apps/api/src/sample-notes/notes.repository.ts:36` and
`apps/api/src/audit/audit.service.ts:21`.

The note INSERT commits before the separate audit call. If the audit operation fails, a note
exists without its required audit entry, although the request fails. The hash chain cannot
detect an event that was never appended.

Fix: use one database transaction and pass its client to `AuditService.record`; test that an
audit failure rolls back the note INSERT.

### 7. Medium: API secret loading retrieves privileged database credentials

Evidence: `apps/api/src/secrets/load-secrets.ts:43`,
`infra/envs/dev/secrets.tf`, and `infra/modules/app-host/main.tf:43`.

The loader requests all parameters under the environment path with decryption, then filters
them in JavaScript. That path includes the PostgreSQL administrator and migration passwords.
Those values therefore enter the SDK response even though `API_SECRETS` omits them. The shared
host role also permits reading the whole path. This weakens the intended separation between
the application database account and privileged deployment accounts.

Fix: fetch only explicitly named runtime parameters and separate runtime permissions from
bootstrap/migration permissions. Filtering a decrypted response is not an access boundary.
This finding concerns the committed configuration; live IAM permissions were not inspected.

## Dependency audit and applicability

`pnpm audit --json` successfully queried the npm advisory registry. It reported **17 advisories:
3 critical, 7 high, 5 moderate, 2 low**. These are advisory counts, not 17 proven exploitable
application vulnerabilities. Production-only audit reported two critical and one high, all
matching the pinned Next.js 16.3.8 version.

| Dependency | Audit result | Assessment in this workspace |
| --- | --- | --- |
| Next.js 16.3.8 | Two critical, one high | Upgrade to at least 16.4.1; conditions below qualify current exposure. |
| Storybook 10.6.1 | Critical and high | Development server exposure described above; upgrade to at least 10.6.2. |
| Vite 8.3.2 | One high, four moderate, one low | Development tooling advisories; audit lists 8.3.3 as the patched version for the reported ranges. |
| Lighthouse CLI transitive dependencies | Four high, one moderate, one low | Includes tmp, extract-zip, basic-ftp and uuid; assess tooling inputs and update the dependency chain. |

The Next.js image-optimization RCE advisory requires affected image-processing code on glibc
Linux. This lockfile already resolves **sharp 0.35.5**, the advisory's workaround, and the
committed web runtime uses Alpine. I did not establish an exploitable image RCE here.
The other RCE requires a `use cache` function returning multiple typed arrays, and the DoS
requires a Server Action. Neither feature was found in the current web source/configuration.
The version audit still fails, and upgrading avoids relying on these conditions staying absent.

Sources: [image advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw),
[cache advisory](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr),
[Server Actions advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r).

CI currently audits production dependencies only (`.github/workflows/ci.yml:67`), so it does
not gate the Storybook and Vite development advisories. Include development tooling in the
dependency security gate with documented exceptions where necessary.

## Existing protections observed

- Authorization refuses routes without explicit roles/public metadata; note queries scope by owner.
- Note SQL is parameterized; input validation rejects unexpected fields and limits note size.
- Tokens are random and stored by hash; refresh cookies are Secure, HttpOnly and SameSite=Strict.
- Field encryption uses AES-256-GCM with random IVs, fixed tag length and domain/version AAD.
- PostgreSQL and Redis clients require verified TLS. Audit tables have separate ownership.
- The web CSP uses nonces. Admin publishing is loopback-only; database ports are not publicly published.
- Infrastructure defines private encrypted buckets, encrypted host disks and IMDSv2.

These source-level protections do not establish that every deployed control is configured correctly.

## Verification limits

- Crypto unit tests: **15 passed across 3 files**.
- API tests initially failed because the sandbox blocked SWC's native cache. An approved rerun
  started, but made no further progress for several minutes; API and web test workers were stopped.
  Several dependency files have the macOS `dataless` flag. The installed Node is 26.10.0 while
  the repository requires Node 24. Full unit/integration/E2E validation is not established.
- Gitleaks history scan reported `fatal: bad object refs/heads/main` and scanned zero commits,
  despite exiting zero. That result is **not a clean history scan**.
- A directory scan encountered many Docker file-read errors and included generated output.
  It reported ten candidates across the broad scan; a narrower apps scan reported two in the
  generated `.next/prerender-manifest.json`, whose preview object contains signing/encryption
  keys. These are generated build credentials, not proof of committed external-service secrets.
  The remaining broad candidates were not validated. Secret-scan coverage remains incomplete.
- No fresh successful Semgrep scan, container vulnerability scan, AWS runtime audit or network
  penetration test is claimed. Existing local images were not assumed to match this worktree.
- Git status/history inspection stalled, so this review identifies the current files rather
  than asserting a verified commit hash or clean working tree.

Prioritize the rate-limit fix, dev login restriction, and Storybook update; then repair session
revocation, refresh coordination, audit transactions and secret separation. Rerun the full checks
under Node 24 from a fully available working copy before handling real patient data. A review
can identify defects and assess controls; it cannot certify that a codebase has no vulnerabilities.

## Remediation (2026-10-24)

Re-verified against `main` at `6057a67` in a fresh clone outside iCloud (no dataless files;
`git fsck --connectivity-only` clean apart from dangling objects), Node 24.22.1 (checksum-verified)
and pnpm 12.8.1. The review had been written against a stale working copy, so three findings were
already partly or wholly fixed on `main`; each is stated below.

### Findings and fixes

| # | State on `main` before this change | Fix (spec 007 criterion) | Regression tests |
| --- | --- | --- | --- |
| 1 Rate-limit bypass | Partly fixed by spec 002: invalid tokens fell back to the address, but a valid token was counted by user only and escaped the address limit | Two throttlers: every request counts by client address (default 200 per route per minute) whatever its Authorization header; a token that resolves to a live session also counts by user (120). Invalid or changing tokens never create a counter. Health probes skip both; RUM caps both (SO-08.12) | `user-throttler.guard.spec.ts` (changing invalid tokens, valid tokens of many users, 1,000 fake tokens make one counter, store failure); `rate-limit.int-spec.ts` (SO-08.12 on protected, public and sign-in routes); `scripts/rate-limit-check.sh` |
| 2 Public test sign-in | Open: any internet client could sign in as the seeded identities on the dev host | API: `TestLoginGate` answers 404 (before body validation) unless the request carries the configured key; dev without a key refuses all; never outside local, test, dev. Network: the public Caddy entry answers test sign-in with 404 and strips the header; a loopback-only entry (127.0.0.1:9443, Session Manager) adds the key from `/heach/dev/TEST_LOGIN_KEY`. Local and CI keep working (SE-07.23) | `test-identity.adapter.spec.ts`, `test-login.gate.spec.ts`, `test-login.int-spec.ts`, `deploy-script.test.mjs`, CI deploy-bundle step; Caddy behaviour checked against a stub upstream |
| 3 Dependencies | Storybook 10.6.2, Vite 8.3.4 and Next.js 16.4.1 already patched (#67, #71; still patched against every advisory listed on 24 October). New: multer (production, high), body-parser (production, high), zod, undici; unfixed extract-zip, tmp, uuid, basic-ftp under `@lhci/cli` 0.15.1 (latest). CI audited `--prod` only | pnpm overrides: `@nestjs/platform-express>multer` 2.5.0; Lighthouse 13.5.0 under `@lhci/cli` and `@lhci/utils` (removes extract-zip entirely); tmp 0.2.7, uuid 11.1.1, basic-ftp 6.2.3; body-parser, undici and zod refreshed within range. CI now runs `pnpm audit --audit-level high` on all dependencies; no exclusions, threshold unchanged (SO-03.2) | Fixture in `scanner-fixtures.sh` now plants a vulnerable dev dependency; Lighthouse CI run with Lighthouse 13 |
| 4 Incomplete device logout | Open: pre-refresh access tokens survived single-device logout | Access tokens are also indexed by session family in Redis; device sign-out takes the user's row lock, revokes every session of the family and then every access token of the family; all-devices unchanged (SE-07.21) | `session.service.spec.ts`; `session-rotation.int-spec.ts`: login, refresh twice, logout, reuse of every earlier token; logout with a pre-refresh token; other device survives; all-devices revokes all |
| 5 Concurrent refresh | Client half fixed by spec 001 (one shared in-flight refresh per tab, Web Locks across tabs, sign-out waits). Server half open: a refresh racing a device logout was treated as a replay and revoked every device | A refresh token whose family has no live session is a plain 401 with the cookie cleared; a replay while the family is live still revokes everything (SE-07.22) | `api.test.ts` (SE-07.5, SE-07.7, SE-07.10, unchanged); `session-rotation.int-spec.ts` SE-07.22 (50 refresh/logout races) and SE-07.18/19 (replays still revoke all) |
| 6 Note and audit not atomic | Already fixed by spec 003: note INSERT and `AuditService.record(…, client)` run in one `withTransaction` | None needed | `audit-transaction.int-spec.ts` "SE-05.5 a failed audit entry leaves no note (repeated 50 times)" on real PostgreSQL; `notes.repository.spec.ts`, `transaction.spec.ts` (re-run: pass) |
| 7 Excessive secret access | Loader already asked by name (`GetParameters`), but the shared host role could read the whole path and containers could use it (IMDS hop limit 2) | New `heach-dev-api` IAM role: `ssm:GetParameters` on exactly DB_APP_PASSWORD, REDIS_PASSWORD, BLIND_INDEX_KEY, TEST_LOGIN_KEY; data-domain KMS keys, uploads, alerts. Host role: parameters (bootstrap, migrations), backup key, backups, `sts:AssumeRole` on the API role; no data keys, uploads or SNS. IMDS hop limit 1. `api-credentials.sh` (timer, every 15 minutes) writes one-hour API-role credentials read through `credential_process`. Bootstrap and migrations get privileged passwords from the host shell for their one-off container only; deploy preflight stops if the role is missing (EN-12.4) | `load-secrets.spec.ts` (exact names per environment, never admin or migrator); `check-infra-security.test.mjs` (wildcard grant, privileged name, hop limit, loader and IAM lists equal); `deploy-script.test.mjs`; SDK credential resolution through `credential_process` checked locally |

### Checks run (24 October 2026, local)

| Check | Result |
| --- | --- |
| `turbo run lint typecheck test build --force` (uncached) | 37 of 37 tasks passed |
| Unit tests | api 84, web 26, ui 55, crypto 15, i18n 13, logger 5, flags 3, types 2, admin 1: all passed |
| API integration (PostgreSQL and Redis, local stack) | 17 files, 120 of 120 passed |
| Script lint and tests (`pnpm lint:scripts`, `pnpm test:scripts`) | Passed; 53 of 53 |
| Changed-line coverage gate (as CI) | 100.0% (52 of 52) |
| `pnpm audit` (all dependencies) and `pnpm audit --prod` | No known vulnerabilities (both) |
| Semgrep 1.179.0 (CI rule set) | 0 findings, 279 files scanned including every changed source file; 2 partial-parse warnings in unchanged `scripts/check-pr-spec.mjs` and `scripts/check-specs.mjs` |
| gitleaks 8.30.1, history | 113 commits scanned, no leaks |
| gitleaks, changed directories (`apps/api/src`, `apps/api/test`, `deploy`, `infra`, `scripts`, spec 007, `.github`) | No leaks; non-zero bytes scanned each; no files skipped |
| `tofu fmt -check -recursive infra`; `tofu validate` (envs/dev, modules/app-host) | Passed |
| `check-infra-security.mjs`, `check-specs.mjs`, `prettier --check .` | Passed |
| Caddyfile with the patched Caddy (`caddy validate`) and a routing test against stub upstreams | Valid; public test sign-in (also other case, trailing and double slash) 404; client key stripped on the public entry; loopback entry (also as `localhost`) adds the key |
| Lighthouse CI with the Lighthouse 13 override | 9 runs, performance 0.91 to 0.93 (gate 0.90) |
| shellcheck on changed shell scripts | Clean (one intentional JMESPath literal annotated) |

### Not run, remaining risks and manual steps

- ~~Infrastructure is not applied.~~ Applied by the owner on 24 October 2026 (4 added, 2 changed,
  no replacement, no cost) and Deploy dev re-run green; see the live verification below.
- **Not run locally:** the deploy-bundle E2E through the loopback entry (runs in CI), the Trivy
  image scan, and the full Playwright suites. Web code is unchanged.
- Rate-limit counters stay in memory: correct for the one API process that runs; shared (Redis)
  counters are needed before a second process (backlog item 8). Caddy's per-address edge limit
  remains in front.
- Browsers without Web Locks (iOS before 15.4) can still race two tabs into a replay; no grace
  window was added (owner decision in spec 004).
- The Trivy image scan still uses `--ignore-unfixed` (pre-existing, outside this dependency audit).
- Pre-existing, not changed here: the admin entry probably does not answer at
  `https://localhost:8443` through port forwarding (status page, documentation gap 13).
- Spec 007 records owner-directed changes made before its approval; it needs the owner's approval
  with the pull request. Test sign-in remains synthetic scaffolding until OTP login (Step 3).

These fixes close the seven findings as written. They do not make the system ready for real
patient data: the Step 2 exit criteria, the remaining Partial items and a penetration test still
stand.

## Live verification after the apply (2026-10-24)

Run by Claude Code on 24 October 2026 between 15:55 and 16:15 UTC, against the dev host
`i-0d548af276bc4fa08` (15.252.65.98) and the AWS account, after the owner's apply and
[Deploy dev run 40095340473](https://github.com/themechanicalguy/heach/actions/runs/40095340473)
(attempt 2, `8b0387f`). Host commands went through SSM Run Command; nothing printed a secret
value. The only writes were synthetic: test sign-ins of the seeded users and the alert and backup
checks recorded in the [Step 2 log](../step-2-progress.md).

| Check | Result |
| --- | --- |
| `tofu plan` on `infra/envs/dev` | `No changes. Your infrastructure matches the configuration.` |
| Deployed version | `/opt/heach/DEPLOYED_TAG` and all three app containers: `8b0387f0cedb`; API and web healthy |
| `/healthz`, `/api/readyz` from the internet | 200; `{"status":"ok","checks":{"postgres":"ok","redis":"ok"}}` |
| API role policy (`heach-dev-api`, `api-runtime`) | `ssm:GetParameters` on exactly DB_APP_PASSWORD, REDIS_PASSWORD, BLIND_INDEX_KEY, TEST_LOGIN_KEY; the four data-domain keys (GenerateDataKey, Decrypt); uploads bucket; `sns:Publish` on the alert topic. Trust: only `heach-dev-host` |
| IAM simulation, API role | Allowed: `GetParameters` on its four names; Decrypt on the health key. Implicit deny: `GetParameters`/`GetParameter` on POSTGRES_PASSWORD and DB_MIGRATOR_PASSWORD, `GetParameter` on its own names, `GetParametersByPath` on `/heach/dev`, backups bucket GetObject, backup-key Decrypt, `sts:AssumeRole` on the host role, Encrypt on the health key |
| Host role (`pull-images-read-config`) | ECR pull; `ssm:GetParameter(s)` under `/heach/dev/*` (bootstrap, migrations); `sts:AssumeRole` on the API role; backup key; backups `pg/*`. No data-domain keys, uploads or SNS. `ssm:GetParametersByPath` is gone (the earlier optional owner action is done) |
| `/heach/dev/TEST_LOGIN_KEY` | Exists, SecureString, created 2026-10-24 15:25 UTC |
| Instance metadata | `HttpTokens` required, `HttpPutResponseHopLimit` 1 |
| From inside the API container | Identity is `assumed-role/heach-dev-api`; POSTGRES_PASSWORD and DB_MIGRATOR_PASSWORD: `AccessDeniedException`; own four parameters: 4 returned, 0 invalid; IMDSv2 token request: timeout (hop limit); IMDSv1: 401. No secret variable and no `AWS_ACCESS_KEY_ID` in its environment |
| From the host | IMDSv2 token 200 (host role still works for the host itself) |
| API credentials | `heach-api-credentials.timer` active; `/opt/heach/aws/credentials.json` mode 640, refreshed 15:58 UTC |
| Test sign-in, public entry, from the internet | 404 for `/api/v1/auth/test-login` and `/api/v1/auth//TEST-LOGIN`, with no key and with a random key |
| Test sign-in, public entry, on the host with the public host name | 404 with no key and with a random key (0 bytes, no cookie) |
| Test sign-in, loopback entry 9443 (`localhost` and the public host name) | 200 with an access token and the `heach_refresh` cookie (synthetic user `…0001`) |
| API direct on 3001, no key | 404 |
| Ports 9443 and 8443 | Listening on 127.0.0.1 only; unreachable from the internet |

Two observations, neither a defect of the fixes:

- On the host, `https://127.0.0.1` and `https://127.0.0.1:9443` answer **200 with an empty body**
  for any request, because no Caddy site has the address `127.0.0.1` on the dev host
  (`PUBLIC_HOST` is the public IP; CI sets it to `127.0.0.1`, so CI's names match). That is Caddy's
  default for an unknown host name, not a sign-in: no token, no cookie. Checks on the host must use
  `localhost` or the public host name.
- `https://localhost:8443` (admin through port forwarding) also answers an empty 200, while the
  public host name on 8443 serves the admin page: documentation gap 13 on the
  [status page](../implementation-status.md#documentation-gaps-found-in-review), now reproduced on
  the dev host.

