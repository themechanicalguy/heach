# HEACH

Healthcare services web application for Odisha, India: patients find, book and pay verified
care providers. See [`docs/`](docs/) for the requirements and implementation guideline, and
[`CLAUDE.md`](CLAUDE.md) for working rules.

## Getting started

Prerequisites: Node 24 LTS (see `.nvmrc`), pnpm (version pinned in `package.json`), Docker.

```sh
nvm use
pnpm install
pnpm dev:up      # creates .env, picks free ports, starts PostgreSQL, Redis, S3, Mailpit, then the apps
pnpm dev:down    # stops the services (after Ctrl+C on the apps)
```

Web http://localhost:3000, admin http://localhost:5173, API http://localhost:3001
(`/readyz`, `/docs`), mail and SMS inbox http://localhost:8025.

Full guide: [`docs/local-development.md`](docs/local-development.md). All commands are listed in
[`CLAUDE.md`](CLAUDE.md#commands).
