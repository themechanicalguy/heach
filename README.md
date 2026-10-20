# HEACH

Healthcare services web application for Odisha, India: patients find, book and pay verified
care providers. See [`docs/`](docs/) for the requirements and implementation guideline, and
[`CLAUDE.md`](CLAUDE.md) for working rules ([`AGENTS.md`](AGENTS.md) for other coding agents). Specs
are written with GitHub Spec Kit: see the [spec workflow](docs/spec-workflow.md).

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

Full guide: [`docs/local-development.md`](docs/local-development.md).

## Commands

```sh
pnpm dev                                # run every app (services must already be up)
pnpm check                              # lint + typecheck + unit tests + build, as CI runs it
pnpm lint | typecheck | test | build    # one step of check on its own
pnpm format                             # Prettier write; format:check to verify only
pnpm secrets:scan                       # gitleaks over the whole git history
pnpm --filter @heach/types generate     # after changing API routes or DTOs
pnpm --filter <pkg> <script>            # one workspace's script
```

## Repository layout

```
apps/web        Next.js PWA for patients and providers
apps/admin      React (Vite) admin panel, desktop first
apps/api        NestJS API
packages/       config, ui, i18n, types, crypto, logger (shared)
docs/           requirements, guideline, local development, ADRs
```

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before your first change. Run `pnpm check` before opening
a pull request. Security issues: [`SECURITY.md`](SECURITY.md).
