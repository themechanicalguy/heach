# Local development

Everything runs on your machine with throwaway credentials. No real email or SMS is ever sent,
and no production data is ever used locally (SO-07): test data is synthetic.

## Prerequisites

- Node 24 LTS (`nvm use` reads `.nvmrc`)
- pnpm (version pinned in `package.json`): `npm install -g pnpm`
- Docker Desktop, running

## From a clean clone

```sh
git clone https://github.com/themechanicalguy/heach.git && cd heach
nvm use
pnpm install
pnpm dev:up
```

`pnpm dev:up` does four things:

1. **`.env`**: creates it from `.env.example` (git-ignored). If it already exists, existing
   values are never changed; keys it is missing are appended with their placeholder values.
2. **Ports**: if another program (another project's database or container, a dev server)
   already uses one of HEACH's ports, that service moves to the next free port. `.env` and the
   matching URL (`DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT`) are updated, and each move is
   printed. Ports held by HEACH's own running containers are not treated as clashes.
3. **Services**: starts PostgreSQL, Redis, the S3 store and Mailpit, waits until each reports
   healthy, and creates the local bucket if it does not exist.
4. **Apps**: builds the shared packages, then starts the three apps with hot reload on the
   ports in `.env`.

It finishes by printing the URL of everything it started. Moved ports stay in `.env` until you
change them back.

Stop the apps with `Ctrl+C`, then stop the services with `pnpm dev:down`. Your local data is
kept in Docker volumes between runs.

## What runs where

Default ports are below; `pnpm dev:up` prints the actual ones.

| What | URL | Notes |
| --- | --- | --- |
| Web (patients, providers) | http://localhost:3000 | |
| Admin | http://localhost:5173 | |
| API | http://localhost:3001 | OpenAPI docs at `/docs` |
| API readiness | http://localhost:3001/readyz | `200` when PostgreSQL and Redis answer, `503` otherwise |
| Mailpit inbox | http://localhost:8025 | Every email, and every SMS in local mode |
| PostgreSQL | `localhost:5433` | Credentials in `.env` |
| Redis | `localhost:6379` | Password in `.env` |
| S3 store (SeaweedFS) | http://localhost:8333 | Bucket `heach-local`, keys in `.env` |

All service ports listen on `127.0.0.1` only. Local connections do not use TLS; staging and
production require it (EN-01).

## Email and SMS

Nothing leaves your machine. Email goes to Mailpit over SMTP (`localhost:1025`). With
`SMS_PROVIDER=local`, the SMS adapter (Step 2) delivers each message to Mailpit as an email, so
OTPs and notifications can be read in the inbox.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev:up` | Setup, start and wait for services, then start the apps |
| `pnpm services:up` | Same port checks, start the services only (no apps) |
| `pnpm dev:down` | Stop the services (data kept) |
| `pnpm services:reset` | Stop the services and **delete all local data** |
| `docker compose ps` | Service status and health |
| `docker compose logs -f postgres` | Follow one service's logs |

## Git hooks

`pnpm install` points git at `.githooks/` (no extra tools). They run on every commit and push:

| Hook | Checks |
| --- | --- |
| `pre-commit` | No `.env` files staged (only `.env.example`); no secrets in staged changes (gitleaks, findings redacted); Prettier and ESLint on staged files only; typecheck of the packages those files belong to and the packages that depend on them (TypeScript cannot check single files) |
| `commit-msg` | [Conventional Commits](https://www.conventionalcommits.org): `<type>(<scope>): <summary>`, for example `fix(api): close Redis on shutdown` |
| `pre-push` | Blocks pushing to `main`; push a branch and open a pull request |

The secret scan uses gitleaks if it is installed, otherwise its pinned Docker image (Docker must
be running). CI scans the whole history again, so a skipped hook does not skip the check.
`pnpm secrets:scan` runs the full-history scan locally. Before opening a pull request, run
`pnpm check`: the same lint, typecheck, unit tests and build that CI runs.

ESLint fails on hard-coded user-facing text in JSX (`<p>Hello</p>`, `alt="…"`); use `t(key)`
instead (I18N-02.1).

If a hook blocks you, fix the cause. `--no-verify` skips hooks; never use it to commit a secret.
If a secret was ever committed, treat it as leaked: rotate it, even after removing it.

## Troubleshooting

- **`set POSTGRES_USER in .env`** (or any `set … in .env`): your `.env` predates a new
  variable. Run `pnpm setup`; it appends the missing keys.
- **A port moved**: expected when another program holds it. To go back to the default, stop
  that program and set the `*_PORT` value and its URL in `.env` back by hand.
- **`port is already allocated` from plain `docker compose up`**: only `pnpm dev:up` and
  `pnpm services:up` check ports; use those.
- **`pnpm dev` without `dev:up`**: apps use the default ports, not the ones in `.env`.
- **`Cannot connect to the Docker daemon`**: start Docker Desktop.
- **`/readyz` returns 503**: run `docker compose ps`; the check marked `down` names the service.
- **Start completely fresh**: `pnpm services:reset`, then `pnpm dev:up`.

## Database TLS, roles and migrations (Step 2)

- PostgreSQL and Redis accept TLS only (EN-01.1). `pnpm setup` creates a local CA and server
  certificate in `.certs/` (git-ignored) and writes `DATA_TLS_CA_FILE` to `.env`. Existing
  `.env` files are upgraded to `rediss://` and the API database role.
- `pnpm dev:up` runs `db:bootstrap` (roles, schemas, audit log, as the superuser) and
  `db:migrate` (as `heach_migrator`). Run them alone with `pnpm --filter @heach/api db:bootstrap`
  and `db:migrate`; add a migration as `apps/api/migrations/NNNN_name.sql`.
- Every column needs `COMMENT ON COLUMN … IS 'class=<class>'`; Restricted columns use the
  `app.encrypted_field` type. `pnpm --filter @heach/api db:check-classes` checks this (DC-01).
- After pulling Step 2, run `pnpm services:reset` only if PostgreSQL fails to start with the new
  TLS entrypoint; it wipes local data.

## Logs, traces and metrics (Step 2, LM-01 to LM-05)

- The API logs JSON lines through `@heach/logger`: every line carries `correlationId` and, when
  tracing is on, `traceId`. Names, mobile numbers and Restricted fields are masked at the top
  level and one level deep; deeper values are not yet (LM-02.1,
  [FU-27](follow-up-register.md#closes-step-2)).
- `pnpm dev:up` starts the OpenTelemetry Collector and Jaeger. Open http://localhost:16686 and
  search service `heach-api`, or tag `heach.correlation_id=<id>` from a response's
  `x-correlation-id` header, to see the request with its PostgreSQL and Redis spans.
- The Collector exposes request metrics in Prometheus format on http://localhost:8889/metrics.
- Unset `OTEL_EXPORTER_OTLP_ENDPOINT` to turn telemetry off. The dev host runs without it
  (ADR 0010): there, logs are the record.

## Web app shell and the sample note (Step 2)

- Pages live under `/or`, `/en` and `/hi`; `/` redirects by browser language, Odia by default.
- With `pnpm dev:up` running, open http://localhost:3000/or/sign-in, choose a synthetic patient,
  and write a note at `/or/notes`. The note is encrypted before it reaches PostgreSQL and every
  read is in `audit.entry`. The pages exist only while `sample-patient-note` is on (FF-01).
- `pnpm --filter @heach/web test:e2e` runs the browser suites on mobile, tablet and desktop.
  Add `E2E_API=1` to include the full sample-note flow (needs the API running).
- Visual baselines (`apps/web/e2e/__screenshots__`) are Linux renders. To update them after an
  intended change, run the suite in the Playwright container against your local server:
  `docker run --rm --network host -v "$PWD:$PWD" -w "$PWD/apps/web" -e E2E_BASE_URL=http://host.docker.internal:3100 mcr.microsoft.com/playwright:v1.63.0-noble node node_modules/@playwright/test/cli.js test -g "TS-07.1|UX-03.1" --update-snapshots=all`.
- `pnpm --filter @heach/web lighthouse` runs Lighthouse CI on the shell (mobile, at least 90).
- Front-end errors go to GlitchTip only when `NEXT_PUBLIC_GLITCHTIP_DSN` is set at build time.
- `docker compose --profile observability up -d` adds GlitchTip, Prometheus and Grafana (the
  LM-05.1 dashboard) locally; see [the runbook](runbooks/error-tracking.md).
