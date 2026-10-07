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

`pnpm dev:up` does three things:

1. `pnpm setup`: creates `.env` from `.env.example` (git-ignored). If `.env` already exists it
   only lists keys you are missing; copy those from `.env.example`.
2. `pnpm services:up`: starts PostgreSQL, Redis, the S3 store and Mailpit, waits until each
   reports healthy, and creates the local bucket.
3. `pnpm dev`: builds the shared packages, then starts the three apps with hot reload.

Stop the apps with `Ctrl+C`, then stop the services with `pnpm dev:down`. Your local data is
kept in Docker volumes between runs.

## What runs where

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
| `pnpm services:up` | Start the services only |
| `pnpm dev:down` | Stop the services (data kept) |
| `pnpm services:reset` | Stop the services and **delete all local data** |
| `docker compose ps` | Service status and health |
| `docker compose logs -f postgres` | Follow one service's logs |

## Troubleshooting

- **`set POSTGRES_USER in .env`** (or any `set … in .env`): your `.env` predates a new
  variable. Run `pnpm setup` to list what is missing and copy it from `.env.example`.
- **`port is already allocated`**: something else uses that port. Stop it, or change the
  matching `*_PORT` value in `.env` and the URL that uses it.
- **`Cannot connect to the Docker daemon`**: start Docker Desktop.
- **`/readyz` returns 503**: run `docker compose ps`; the check marked `down` names the service.
- **Start completely fresh**: `pnpm services:reset`, then `pnpm dev:up`.
