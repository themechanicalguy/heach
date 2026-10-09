# Contributing to HEACH

HEACH handles sensitive patient data. Security and data protection come before speed in every
decision. Read [`CLAUDE.md`](CLAUDE.md) (working rules) and the two documents in [`docs/`](docs/)
before starting any work.

## Workflow

0. **Start from the spec.** A step's code starts only after its spec in
   [`docs/specs/`](docs/specs/README.md) is approved. A change of behaviour updates the spec first
   ([ADR 0007](docs/adr/0007-spec-driven-development.md)).
1. **Branch from `main`.** Names: `feat/…`, `fix/…`, `chore/…`, `docs/…` (Step 1 parts used
   `step1/…`). Never commit or push to `main`; the pre-push hook blocks it.
2. **Run it locally**: `pnpm dev:up` (see [local development](docs/local-development.md)).
3. **Commit** with [Conventional Commits](https://www.conventionalcommits.org):
   `feat(api): add readiness checks`. Hooks check secrets, formatting, lint, types and the message.
4. **Before opening a pull request** run `pnpm check` (what CI runs). If you changed API routes
   or DTOs, run `pnpm --filter @heach/types generate` and commit the result.
5. **Open a pull request.** Fill in the template, including every definition-of-done item that
   applies. Link requirement IDs (`BK-03`, `EN-07`).
   Update [implementation status](docs/implementation-status.md) for every step item or
   requirement ID the change builds, extends or removes. CI checks this; for a change that moves
   no item (refactor, dependency bump), add the `no-status-change` label instead.
6. **Merge only when all CI jobs pass**: Checks, E2E smoke, API image, Deploy bundle, Infra,
   Secret scan, Implementation status updated. The repository
   is on GitHub Free, so nothing enforces this except us
   ([ADR 0004](docs/adr/0004-github-free-no-branch-protection.md)).

## Rules that are never relaxed

- **No secrets** in code, tests, fixtures, Dockerfiles or CI. Never use `--no-verify` to get past
  the secret scan. A secret that reached any commit is leaked: rotate it.
- **No real personal or health data** anywhere outside production: development and test data
  is synthetic (SO-07).
- **No personal or health data in logs**, URLs, error messages, analytics, SMS or push text.
  Use `@heach/logger`, never `console.log`.
- **No improvised cryptography.** `@heach/crypto` is the only place encryption will live
  ([README](packages/crypto/README.md)).
- **No hard-coded user-facing text.** Use `t(key)`; ESLint warns now and fails from Step 2.
- **Authorisation on the server** for every request and object.
- **New dependencies need approval** when they are outside the stack in `CLAUDE.md`: state what
  it does, its licence, maintenance status and the in-stack alternative.

## Code style

Reuse before creating; keep functions short (aim under 30 lines, ESLint fails over 100); keep it
simple; follow each framework's conventions. Details in [`CLAUDE.md`](CLAUDE.md#code-style).

## Decisions

Significant technical decisions are recorded as ADRs in [`docs/adr/`](docs/adr/). Copy
[the template](docs/adr/0000-template.md), take the next number, and open it in the same pull
request as the change it describes.

## Reporting a security issue

See [`SECURITY.md`](SECURITY.md). Do not open a public issue or pull request for it.
