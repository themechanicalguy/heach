# 0003. Enforce quality and secret scanning with git hooks, gitleaks and CI

- **Status:** Accepted
- **Date:** 2026-10-07
- **Requirements:** EN-12, SO-03, I18N-02

## Context

Secrets must never reach the repository, and every change must pass the same checks locally
and in CI. GitHub's own secret scanning is not available for private repositories on GitHub Free.

## Decision

- Git hooks in `.githooks/` (installed by `pnpm install` and `pnpm setup`): pre-commit (no `.env`
  files, gitleaks on staged changes, Prettier and ESLint on staged files, typecheck of affected
  packages), commit-msg (Conventional Commits), pre-push (no pushes to `main`).
- gitleaks runs from its Docker image, pinned by digest, or a local install. CI scans the whole
  history on every pull request and push.
- `pnpm check` (lint, typecheck, unit tests, build) is exactly what CI runs.
- Hard-coded user-facing text is flagged with ESLint's built-in `no-restricted-syntax`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Plain hooks and scripts (chosen) | No new npm dependencies; small and readable | Our own code to maintain |
| husky, lint-staged, commitlint | Widely used | Three or more extra dependencies |
| eslint-plugin-i18next | Purpose-built string rule | Extra dependency for a few selectors |

## Consequences

- Docker must be running to commit, unless gitleaks is installed.
- Hooks can be skipped with `--no-verify`; CI repeats every check.
