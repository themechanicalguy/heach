# Step 2: Secure foundation and quality gates

- **Status:** Approved (on merge)
- **Guideline:** [Step 2](../mvp-v1-implementation-guideline.md#step-2-secure-foundation-and-quality-gates)
- **Requirements in scope:** EN-01 to EN-06, EN-09 to EN-13, SE-02, SE-05, SE-07, SE-09, SO-01,
  SO-03, SO-05, SO-08, LM-01 to LM-05, LM-07, LM-09, I18N-01 to I18N-04, I18N-06, I18N-07, UX-01
  to UX-05, TS-01 to TS-03, TS-05 to TS-07, TS-09 (encryption and authorisation parts), PF-01 to
  PF-03, PF-05 to PF-07
- **Out of scope:**
  - OTP login, sign-up, roles in use, Aadhaar and DigiLocker (Step 3); this step uses a test
    identity adapter only
  - Uploaded files and virus scanning, EN-07 (Step with the vault); video media, EN-08
  - SE-01, SE-03, SE-04, SE-06, SE-08: need real roles, bookings and the admin panel (Steps 3+)
  - LM-06 business metrics, LM-08 status page, TS-04 journey E2E, TS-08 load test (later steps)
  - Dynamic scan and penetration test, SO-04; production access, SO-06 (before pilot)
  - Paid plan, budgets (B6) and the pilot (Track P)

The sample entity `patient_note` exists only to prove the exit criteria end to end. It is behind
the `sample-patient-note` feature flag, off outside dev and test, and is removed in Step 3.

## Constraints from earlier decisions

- Lean single host on credits ([ADR 0008](../adr/0008-lean-single-host-on-credits.md)):
  PostgreSQL, Redis and observability run as containers on the dev host; no managed database,
  NAT gateway or load balancer.
- One AWS Region (ap-south-1) for every Regional resource; no cross-Region replication. EN-10 is
  reworded accordingly (decision D1).
- No new paid AWS service: secrets stay in Parameter Store (D2); the WAF moves to the pilot (D3).
- New dependencies are free, open source and self-hosted only, listed under Dependencies (D4).

## Acceptance criteria

### Encryption (EN-01 to EN-06, EN-09, EN-13)

| ID | Given / when / then | Proof |
| --- | --- | --- |
| EN-01.1 | When the API connects to PostgreSQL and Redis, then TLS is required; a plaintext connection is refused | Integration test |
| EN-01.2 | When a browser requests any page or API route, then the response carries HSTS (`max-age` ≥ 1 year) | Integration test |
| EN-01.3 | Given the dev host, when TLS is negotiated, then the version is 1.2 or higher and 1.3 is offered | Manual: `openssl s_client` output in the PR |
| EN-02.1 | Given the Terraform for dev, then every disk, bucket, snapshot and backup has KMS encryption | `scripts/check-tags.mjs` style check in CI |
| EN-03.1 | Given a Restricted field, when it is saved, then the database holds ciphertext only | Integration test |
| EN-03.2 | Given ciphertext whose auth tag was altered, when it is decrypted, then an error is raised and nothing is returned | Unit test |
| EN-04.1 | When a value is encrypted, then a data key from KMS `GenerateDataKey` encrypts it with AES-256-GCM, and only the wrapped data key is stored | Unit test with a KMS test double |
| EN-04.2 | Then the master key never leaves KMS; the API role can call only `GenerateDataKey` and `Decrypt` on its own environment's keys | Terraform policy review plus `tofu plan` |
| EN-05.1 | Given values encrypted under key version 1, when the data key is rotated to version 2, then old values still decrypt and new ones use version 2 | Unit test |
| EN-05.2 | Then KMS automatic yearly rotation is on for every master key | Terraform check |
| EN-05.3 | Then a documented re-encryption job re-encrypts one domain to the current version | Integration test plus runbook in `docs/` |
| EN-06.1 | Given a value encrypted for domain `health`, when it is decrypted with the `identity` key, then decryption fails | Unit test |
| EN-09.1 | Given a searchable Restricted field, when it is stored, then its lookup column is an HMAC-SHA-256 blind index with a per-domain key, never plaintext | Unit and integration test |
| EN-09.2 | When a record is found by that field, then the query uses the blind index only | Integration test |
| EN-13.1 | Given a saved sample note, then its body is ciphertext in the database, absent from all log output, and absent from the response to another user | Integration test |

### Data classification

| ID | Given / when / then | Proof |
| --- | --- | --- |
| DC-01.1 | Given a schema field without a class tag, when CI runs, then the build fails naming the field | CI check with a failing fixture |
| DC-01.2 | Given a field tagged Restricted that is not stored through `@heach/crypto`, then the build fails | CI check |

DC is a new criterion group for guideline item 2; the requirements' data classification section
is its source.

### Database and backups (EN-10)

| ID | Given / when / then | Proof |
| --- | --- | --- |
| EN-10.1 | Migrations run forward from an empty database and are checked in CI | CI job |
| EN-10.2 | The API connects as a role that can read and write application tables only; migrations use a separate role; neither can change the audit schema | Integration test |
| EN-10.3 | A nightly backup is encrypted with its own KMS key and stored in a private ap-south-1 bucket; a weekly encrypted copy is stored outside the AWS account | Manual: object listing in the PR |
| EN-10.4 | A backup is restored to an empty database and the sample note decrypts | Manual restore record in `docs/` |

### Secrets (EN-12)

| ID | Given / when / then | Proof |
| --- | --- | --- |
| EN-12.1 | The API reads secrets from Parameter Store SecureString at start-up; none are in the image, Compose file or environment of the image build | Container scan plus review |
| EN-12.2 | A rotation procedure is written and run once in dev for the database password | Manual record in `docs/` |
| EN-12.3 | A commit that contains a secret is blocked by the pre-commit hook and by CI | Existing gitleaks job plus a fixture test |

### Authorisation and sessions (SE-02, SE-07, TS-09)

| ID | Given / when / then | Proof |
| --- | --- | --- |
| SE-02.1 | Every route declares its allowed roles; a route without a declaration fails the build | Unit test over the route table |
| SE-02.2 | The authorisation harness calls every endpoint as every role and as anonymous, and compares the result with the matrix in this spec | Integration test (TS-09) |
| SE-02.3 | Given user B, when B reads user A's note by ID, then the API returns 404 and writes an audit entry for the denied attempt | Integration test |
| SE-07.1 | Access tokens live ≤ 15 minutes; refresh tokens rotate on every use and sit in a `Secure`, `HttpOnly`, `SameSite=Strict` cookie | Integration test |
| SE-07.2 | When a used refresh token is replayed, then every session of that user is revoked | Integration test |
| SE-07.3 | When a user logs out of all devices, then every refresh token for that user stops working | Integration test |
| SE-07.4 | The test identity adapter is refused at start-up unless the environment is `test` or `dev` | Unit test |
| SE-09.1 | Responses carrying Restricted data set `Cache-Control: no-store` | Integration test |

### Audit log (SE-05, LM-09)

| ID | Given / when / then | Proof |
| --- | --- | --- |
| SE-05.1 | Every read and write of a Restricted field goes through the audit helper; a repository method that skips it fails a test | Unit test |
| SE-05.2 | Each entry holds actor, role, action, entity, entity ID, time, correlation ID and the hash of the previous entry; no Restricted values | Unit test |
| SE-05.3 | Given an entry that was altered or deleted, when the verifier runs, then it reports the first broken link | Integration test |
| SE-05.4 | The audit table is in its own schema; the application role can only insert into it | Integration test |

### Security middleware and scanning (SO-01, SO-03, SO-05, SO-08)

| ID | Given / when / then | Proof |
| --- | --- | --- |
| SO-01.1 | The spec template's threat model section is required; a spec PR without it fails review | `docs/specs/0000-template.md` plus this spec |
| SO-03.1 | Every PR runs static analysis, dependency scan, container image scan and secret scan; a high finding fails the PR | CI with a failing fixture per scanner |
| SO-05.1 | Every response carries CSP (no `unsafe-inline` scripts), HSTS, `X-Frame-Options: DENY`, `Referrer-Policy` and `X-Content-Type-Options` | Integration test |
| SO-05.2 | Every request body and parameter is validated against its DTO; unknown fields are rejected with 400 and no echo of the input | Integration test |
| SO-08.1 | More than the configured requests per minute from one IP or user returns 429 | Integration test |
| SO-08.2 | Caddy and the API rate limits are on, and input validation rejects a sample SQL injection request with 400. A WAF follows at the pilot (D3) | Integration test |
| SO-08.3 | Ten authorisation failures from one user within five minutes raise an alert | Integration test against the alert rule |

### Logging and monitoring (LM-01 to LM-05, LM-07)

| ID | Given / when / then | Proof |
| --- | --- | --- |
| LM-01.1 | A request from the browser carries one correlation ID through the API to the database query and the log lines | E2E test reading the trace |
| LM-02.1 | Given a log call with a name, mobile number or a Restricted field, then the output is masked | Unit test in `@heach/logger` |
| LM-02.2 | ESLint fails on `console.*` in app code | Lint fixture |
| LM-03.1 | A thrown front-end error is recorded with source map, release tag and role, and no user identity | Manual record |
| LM-04.1 | Core Web Vitals are reported per route and device class | Manual record |
| LM-05.1 | API request rate, error rate and p50, p95, p99 latency appear on one dashboard; traces use OpenTelemetry | Manual record |
| LM-07.1 | An API error rate above 5 percent for five minutes sends one alert to the `heach-credit-reminders` SNS topic | Manual: test alert record |

### Internationalisation (I18N-01 to I18N-04, I18N-06, I18N-07)

| ID | Given / when / then | Proof |
| --- | --- | --- |
| I18N-01.1 | `/or`, `/en` and `/hi` serve the app; a new locale needs only a catalogue file and a config entry | E2E test |
| I18N-02.1 | A hard-coded string in JSX or a component prop fails lint | Lint fixture |
| I18N-02.2 | Messages use ICU plural format | Unit test |
| I18N-03.1 | ₹1,23,456.50 and dates format per locale | Unit test |
| I18N-04.1 | An Odia note survives save and read unchanged (UTF-8 throughout) | Integration test |
| I18N-06.1 | Odia and Devanagari fonts are bundled and subset; pages render at 140 percent text length without overflow | Visual snapshot |
| I18N-07.1 | A key missing in any locale fails CI | Existing check plus fixture |

### Design system (UX-01 to UX-05)

| ID | Given / when / then | Proof |
| --- | --- | --- |
| UX-01.1 | Button, input, OTP field, card, sheet, table, toast and bottom navigation exist in `@heach/ui` with Storybook stories | Storybook build in CI |
| UX-01.2 | Each story passes axe with no violations | Component tests |
| UX-02.1 | Layout tokens define 360 to 599, 600 to 1023 and 1024 px and up | Unit test of tokens |
| UX-03.1 | Bottom navigation sits in the thumb zone at 360 px | Visual snapshot |
| UX-04.1 | Loading (skeleton), empty, error and offline states exist as components | Stories |
| UX-05.1 | The OTP field uses `inputmode="numeric"` and `autocomplete="one-time-code"` and keeps input on error | Component test |

### Testing and performance gates (TS-01 to TS-03, TS-05 to TS-07, PF-01 to PF-03, PF-05 to PF-07)

| ID | Given / when / then | Proof |
| --- | --- | --- |
| TS-01.1 | Coverage below 80 percent of lines on changed code fails CI | CI fixture |
| TS-02.1 | Every component in `@heach/ui` has a test with an axe assertion | CI |
| TS-03.1 | API integration tests run against a real PostgreSQL in CI | CI job |
| TS-05.1 | Playwright smoke runs on mobile, tablet and desktop projects on every PR | CI job |
| TS-06.1 | SMS, payment, video and identity adapters have interfaces and test doubles; app code imports only the interfaces | Unit tests plus lint boundary rule |
| TS-07.1 | Visual snapshots of the shell in `or`, `en` and `hi` fail the PR when they change unexpectedly | CI |
| PF-02.1 | Initial JavaScript over 170 KB gzipped on an entry route fails CI | Bundle budget fixture |
| PF-03.1 | Lighthouse mobile performance below 90 on the shell fails CI | Lighthouse CI |
| PF-05.1 | Routes are split; images are served as AVIF or WebP | Build check |
| PF-07.1 | The PWA installs, shows the shell offline with an offline banner, and its service worker caches no API response | E2E test (also EN-11) |

### Feature flags

| ID | Given / when / then | Proof |
| --- | --- | --- |
| FF-01.1 | A flag read on the server defaults to off when unset; flags are set per environment | Unit test |

## Data

| Entity | Field | Class | Notes |
| --- | --- | --- | --- |
| user_test (test adapter only) | id | Internal | UUID; replaced by real accounts in Step 3 |
| user_test | role | Internal | `patient`, `provider`, `admin` |
| session | id | Internal | UUID |
| session | user_id | Internal | |
| session | refresh_token_hash | Confidential | SHA-256 of the token; the token itself is never stored |
| session | family_id | Internal | For replay detection (SE-07.2) |
| session | expires_at, revoked_at | Internal | |
| patient_note | id | Internal | UUID |
| patient_note | owner_id | Internal | |
| patient_note | body | Restricted | Encrypted field, domain `health` |
| patient_note | created_at | Internal | |
| audit_entry | id, at, actor_id, actor_role, action, entity, entity_id, correlation_id | Internal | Separate `audit` schema, insert only |
| audit_entry | prev_hash, hash | Internal | SHA-256 chain (SE-05.3) |
| data_key | domain, version, wrapped_key, created_at, retired_at | Confidential | Wrapped by KMS; plaintext keys live only in memory |

## API

All routes are under `/api/v1`. Errors use the existing error response; they never echo input or
Restricted data.

| Method and path | Roles allowed | Request | Response | Errors |
| --- | --- | --- | --- | --- |
| POST /auth/test-login | anonymous, `test` and `dev` only | `{ userId }` | Access token; refresh cookie | 400, 404 |
| POST /auth/refresh | anonymous with refresh cookie | none | New access token; rotated cookie | 401 |
| POST /auth/logout | any signed-in | `{ allDevices: boolean }` | 204 | 401 |
| POST /sample/notes | patient | `{ body }` (≤ 2,000 characters) | `{ id, createdAt }` | 400, 401, 403, 429 |
| GET /sample/notes/:id | patient, owner only | none | `{ id, body, createdAt }` | 401, 404 |
| GET /sample/notes | patient | none | Own notes only | 401 |

Authorisation matrix (SE-02.2): provider and admin get 403 on every `/sample/notes` route; a
patient who is not the owner gets 404.

## Threat model (SO-01)

| Threat | Mitigation | Criterion |
| --- | --- | --- |
| Spoofing: forged or replayed tokens | Short access tokens, rotating refresh tokens, family revoke | SE-07.1, SE-07.2 |
| Spoofing: test login reaches production | Adapter refuses to start outside `test` and `dev` | SE-07.4 |
| Tampering: audit entries edited | Hash chain, insert-only role, verifier | SE-05.3, SE-05.4 |
| Tampering: ciphertext altered | AES-GCM authentication | EN-03.2 |
| Repudiation: user denies an access | Audit entry per Restricted read and write, with correlation ID | SE-05.1 |
| Information disclosure: database dump | Field-level encryption, blind indexes | EN-03.1, EN-09.1 |
| Information disclosure: logs, URLs, caches | Masking logger, no Restricted data in paths, no-store, no service-worker API cache | LM-02.1, SE-09.1, PF-07.1 |
| Information disclosure: other user's object | Object-level guard, 404 not 403 | SE-02.3 |
| Information disclosure: one key leaks | Per-domain, per-environment keys | EN-06.1 |
| Denial of service: request floods | Rate limits, WAF decision | SO-08.1, SO-08.2 |
| Elevation of privilege: missing route guard | Build fails without a role declaration; harness | SE-02.1, SE-02.2 |

## Screens and languages

- App shell with bottom navigation, offline banner and the sample note form and list, at 360,
  768 and 1280 px, in `or`, `en` and `hi`.
- States: loading (skeleton), empty ("No notes yet"), error, offline.
- New keys: `nav.*`, `offline.banner`, `state.empty`, `state.error`, `sample.note.*`. A native
  Odia speaker reviews the Odia text (I18N-07).

## Dependencies (D4)

Free, open source and self-hosted only. Each is added in the PR that first needs it, with its
version pinned.

| Need | Choice | Licence | In-stack alternative |
| --- | --- | --- | --- |
| Migrations | node-pg-migrate | MIT | Hand-written SQL run by a script |
| Security headers | helmet | MIT | Hand-written middleware |
| Rate limiting | @nestjs/throttler | MIT | Hand-written Redis counter |
| Tracing and metrics | OpenTelemetry JS SDK and Collector | Apache-2.0 | Logs only |
| Trace viewer | Jaeger, on the dev host | Apache-2.0 | Collector file export |
| Error tracking | GlitchTip, locally (ADR 0010), with the Sentry browser SDK | MIT | Errors as logs |
| Real-user monitoring | web-vitals, reported to the API | Apache-2.0 | Lighthouse only |
| Performance gate | Lighthouse CI | Apache-2.0 | None |
| Component docs | Storybook | MIT | None |
| Static analysis | Semgrep CE in CI | LGPL-2.1 | ESLint security rules only |
| Edge rate limit (SO-08.2) | caddy-ratelimit, compiled into the Caddy build, pinned commit | Apache-2.0 | API throttler only |
| Metrics dashboard (LM-05.1) | Prometheus and Grafana OSS, local Docker only | Apache-2.0 / AGPL-3.0 (unmodified) | Raw Collector metrics endpoint |
| Source-map upload (LM-03.1) | No dependency: `scripts/upload-source-maps.mjs` (GlitchTip artifact-bundle API). `@sentry/cli` was approved but its maintained versions are FSL-1.1-MIT, not open source | — | Stack traces without source maps |

Containers added to the dev host must fit its memory; if they do not, the PR says so and asks
before resizing.

## Decisions

Recorded 18 October 2026 by the owner.

| # | Question | Decision |
| --- | --- | --- |
| D1 | EN-10 second Region in a one-Region project | Encrypted backups in ap-south-1 with their own key, plus a weekly encrypted copy outside the AWS account. EN-10 reworded; ADR 0010 records it in the first Step 2 PR |
| D2 | Secrets Manager or Parameter Store | Parameter Store SecureString with a written rotation procedure; revisit at the pilot |
| D3 | WAF now or later | At the pilot; rate limiting and validation now; ADR 0010 records the deferral |
| D4 | New dependencies | Free, open source, self-hosted only; see Dependencies |
| D5 | On-call address | The existing `heach-credit-reminders` SNS topic |
| D6 | Lawyer review | Stays a Step 2 exit criterion only; owner action |

## Open questions

None.
